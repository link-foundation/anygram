import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Anygram, createAdapter } from '../src/index.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const cli = () => import('../examples/follow-cli.mjs');
const channel = (id, username) => ({
  _: 'channel',
  id,
  access_hash: -id,
  title: username,
  username,
  date: 1,
  photo: { _: 'chatPhotoEmpty' },
  megagroup: true,
});
const updates = () => ({
  _: 'updates',
  updates: [],
  chats: [],
  users: [],
  date: 1,
  seq: 1,
});
function page() {
  return {
    _: 'messages.dialogs',
    dialogs: [
      {
        _: 'dialog',
        peer: { _: 'peerChannel', channel_id: 7n },
        top_message: 0,
        read_inbox_max_id: 0,
        read_outbox_max_id: 0,
        unread_count: 0,
        unread_mentions_count: 0,
        unread_reactions_count: 0,
        unread_poll_votes_count: 0,
        notify_settings: { _: 'peerNotifySettings' },
      },
    ],
    chats: [channel(7n, 'existing')],
    users: [],
    messages: [],
  };
}
function response(request) {
  switch (request._) {
    case 'messages.getDialogs':
      return page();
    case 'contacts.resolveUsername':
      return {
        _: 'contacts.resolvedPeer',
        peer: { _: 'peerChannel', channel_id: 8n },
        chats: [channel(8n, request.username)],
        users: [],
      };
    case 'channels.joinChannel':
      return { _: 'messages.chatInviteJoinResultOk', updates: updates() };
    case 'messages.getHistory':
      return {
        _: 'messages.messages',
        messages: [
          {
            _: 'message',
            id: 3,
            peer_id: { _: 'peerChannel', channel_id: 8n },
            date: 1,
            message: 'Recent history',
          },
        ],
        topics: [],
        chats: [],
        users: [],
      };
    case 'channels.leaveChannel':
      return updates();
    default:
      assert.fail(`Unexpected CLI request ${request._}`);
  }
}
function harness(handle = response) {
  const calls = [],
    closed = [],
    output = [];
  let configured = 0;
  const client = new Anygram({
    adapters: [
      createAdapter('mtproto', {
        connect: async () => {},
        call: async (method, params) => {
          const request = { _: method, ...params };
          calls.push(request);
          return handle(request);
        },
        disconnect: async () => closed.push('disconnect'),
        destroy: async () => closed.push('destroy'),
      }),
    ],
  });
  return {
    calls,
    closed,
    output,
    io: {
      write: (value) => output.push(value),
      createAccount: async () => {
        configured++;
        return {
          run: (task) => client.withConnection(task, { cleanupDelay: 0 }),
        };
      },
    },
    configured: () => configured,
  };
}

it('renders CLI help and rejects invalid arguments before account setup or input consumption', async () => {
  const { runFollowCli } = await cli();
  const state = harness();
  assert.equal((await runFollowCli(['--help'], state.io)).exitCode, 0);
  assert.match(state.output.join(''), /follow|join|list|leave/);
  assert.equal(state.configured(), 0);
  for (const args of [
    ['--unknown'],
    ['--delay', '-1'],
    ['--delay', 'Infinity'],
    ['join'],
    ['leave'],
    ['join', 't.me/fresh', '--mute'],
  ]) {
    await assert.rejects(runFollowCli(args, state.io));
  }
  assert.equal(state.configured(), 0);
});

it('supports default and explicit follow commands with named Links Notation and pure JSON', async () => {
  const { runFollowCli } = await cli();
  for (const prefix of [[], ['follow']]) {
    const state = harness();
    const result = await runFollowCli(
      [...prefix, '(telegramLinks: t.me/existing t.me/fresh)', '-d', '0', '-j'],
      state.io
    );
    assert.equal(result.exitCode, 0);
    assert.deepEqual(
      JSON.parse(state.output.join('')).outcomes.map((item) => item.status),
      ['alreadyMember', 'joined']
    );
    assert.equal(
      state.calls.filter((item) => item._ === 'channels.joinChannel').length,
      1
    );
    assert.deepEqual(state.closed, ['disconnect', 'destroy']);
  }
});

it('consumes multiline stdin through the command and retains pending approval without retry', async () => {
  const { runFollowCli } = await cli();
  const state = harness((request) => {
    if (request._ === 'channels.joinChannel') {
      throw new Error('INVITE_REQUEST_SENT');
    }
    return response(request);
  });
  const stdin = (async function* () {
    yield 't.me/existing\nt.me/fresh';
  })();
  const result = await runFollowCli(['--delay', '0', '--json'], {
    ...state.io,
    stdin,
  });
  assert.equal(result.exitCode, 0);
  assert.deepEqual(
    result.result.outcomes.map((item) => item.status),
    ['alreadyMember', 'requestSent']
  );
  assert.equal(
    state.calls.filter((item) => item._ === 'channels.joinChannel').length,
    1
  );
});

it('implements join info and recent-message flags that the archived command calls but never defines', async () => {
  const { runFollowCli } = await cli();
  const state = harness();
  const result = await runFollowCli(
    ['join', 't.me/fresh', '-i', '-m', '-j'],
    state.io
  );
  assert.equal(result.exitCode, 0);
  const data = JSON.parse(state.output.join(''));
  assert.equal(data.info.id, '8');
  assert.equal(data.messages[0].message, 'Recent history');
  assert.equal(
    state.calls.filter((item) => item._ === 'channels.joinChannel').length,
    1
  );
  assert.equal(
    state.calls.filter((item) => item._ === 'messages.getHistory').length,
    1
  );
  assert.deepEqual(state.closed, ['disconnect', 'destroy']);
});

it('lists groups with exact IDs and leaves through canonical operations', async () => {
  const { runFollowCli } = await cli();
  const listing = harness();
  assert.equal(
    (await runFollowCli(['list', '-j', '-v'], listing.io)).exitCode,
    0
  );
  const data = JSON.parse(listing.output.join(''));
  assert.equal(data[0].id, '7');
  assert.equal(data[0].markedId, '-1007');
  assert.equal(data[0].type, 'Supergroup');
  const leaving = harness();
  assert.equal(
    (await runFollowCli(['leave', '@fresh'], leaving.io)).exitCode,
    0
  );
  assert.equal(
    leaving.calls.filter((item) => item._ === 'channels.leaveChannel').length,
    1
  );
  assert.deepEqual(leaving.closed, ['disconnect', 'destroy']);
});

it('returns a failing exit status on invalid links and flood stops, and never swallows cleanup TIMEOUT', async () => {
  const { runFollowCli } = await cli();
  const invalid = harness();
  assert.equal(
    (
      await runFollowCli(
        ['https://example.org/no', '-d', '0', '-j'],
        invalid.io
      )
    ).exitCode,
    1
  );
  const flooded = harness((request) => {
    if (request._ === 'channels.joinChannel') {
      throw new Error('FLOOD_WAIT_9');
    }
    return response(request);
  });
  assert.equal(
    (await runFollowCli(['t.me/fresh t.me/later', '-d', '0', '-j'], flooded.io))
      .exitCode,
    1
  );
  assert.equal(
    flooded.calls.filter((item) => item._ === 'channels.joinChannel').length,
    1
  );
  const failure = new globalThis.AggregateError(
    [new Error('TIMEOUT')],
    'cleanup failed'
  );
  await assert.rejects(
    runFollowCli(['list'], {
      ...invalid.io,
      createAccount: async () => ({
        run: async () => {
          throw failure;
        },
      }),
    }),
    (error) => error === failure
  );
});

it('cancels bounded pacing before the next link and still closes the owned connection', async () => {
  const { runFollowCli } = await cli();
  const controller = new globalThis.AbortController();
  const state = harness((request) => {
    if (request._ === 'channels.joinChannel') {
      globalThis.setTimeout(
        () => controller.abort(new Error('cancel pacing')),
        10
      );
    }
    return response(request);
  });
  await assert.rejects(
    runFollowCli(['t.me/fresh t.me/second', '-d', '1'], {
      ...state.io,
      signal: controller.signal,
    }),
    /cancel pacing/
  );
  assert.equal(
    state.calls.filter((item) => item._ === 'channels.joinChannel').length,
    1
  );
  assert.deepEqual(state.closed, ['disconnect', 'destroy']);
});

it('runs a parsed CLI join and history request over independent encrypted native TCP', async () => {
  const { runFollowCli } = await cli();
  const peer = await secretRpcPeer(response);
  const output = [];
  const client = new Anygram({
    adapters: [createAdapter('mtproto', peer.client)],
  });
  try {
    const result = await runFollowCli(['join', 't.me/fresh', '-m', '-j'], {
      write: (value) => output.push(value),
      createAccount: async () => ({
        run: (task) => client.withConnection(task),
      }),
    });
    assert.equal(result.exitCode, 0);
    assert.equal(
      JSON.parse(output.join('')).messages[0].message,
      'Recent history'
    );
    assert.equal(peer.client.transport.closed, true);
  } finally {
    await peer.close();
  }
});

it('passes explicit cache, environment, session, backend and debug options to the configured account', async () => {
  const { runFollowCli } = await cli();
  const directory = await mkdtemp(join(tmpdir(), 'anygram-follow-cli-'));
  const state = harness();
  const errors = [];
  const cache = join(directory, 'cached.lino');
  const envFile = join(directory, '.env');
  const sessionPath = join(directory, 'session');
  try {
    await writeFile(cache, 't.me/existing');
    await runFollowCli(
      [
        '--cache-file',
        cache,
        '--env-file',
        envFile,
        '--session-file',
        sessionPath,
        '--backend',
        'teleproto',
        '--debug',
        '-d',
        '0',
        '-j',
      ],
      {
        ...state.io,
        writeError: (text) => errors.push(text),
        createAccount: async (options) => {
          assert.equal(options.envFile, envFile);
          assert.equal(options.sessionPath, sessionPath);
          assert.equal(options.backend, 'teleproto');
          options.debug({
            event: 'request',
            backend: 'teleproto',
            operation: 'getDialogs',
          });
          return state.io.createAccount();
        },
      }
    );
    assert.equal(
      JSON.parse(state.output.join('')).outcomes[0].status,
      'alreadyMember'
    );
    assert.equal(JSON.parse(errors.join('')).operation, 'getDialogs');
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('preserves follow mute/archive flags and continues after rate limits only when requested', async () => {
  const { runFollowCli } = await cli();
  const settings = harness((request) => {
    if (request._ === 'account.getNotifySettings') {
      return { _: 'peerNotifySettings', mute_until: 0 };
    }
    if (request._ === 'account.updateNotifySettings') {
      return true;
    }
    if (request._ === 'folders.editPeerFolders') {
      return updates();
    }
    return response(request);
  });
  await runFollowCli(
    ['t.me/existing', '-m', '-a', '-d', '0', '-j'],
    settings.io
  );
  const mute = settings.calls.find(
    (request) => request._ === 'account.updateNotifySettings'
  );
  assert.equal(mute.settings.silent, true);
  assert.equal(mute.settings.show_previews, false);
  assert.equal(
    settings.calls.filter((request) => request._ === 'folders.editPeerFolders')
      .length,
    1
  );
  const flooded = harness((request) => {
    if (request._ === 'channels.joinChannel') {
      throw new Error('FLOOD_WAIT_9');
    }
    return response(request);
  });
  const result = await runFollowCli(
    ['t.me/fresh t.me/later', '--skip-rate-limit', '-d', '0', '-j'],
    flooded.io
  );
  assert.equal(result.result.stop, undefined);
  assert.equal(
    flooded.calls.filter((request) => request._ === 'channels.joinChannel')
      .length,
    2
  );
});

it('follows private message links and leaves large cached channel IDs without a numeric rounding conversion', async () => {
  const { runFollowCli } = await cli();
  const id = 9007199254740993n;
  const handle = (request) => {
    if (request._ === 'messages.getDialogs') {
      const result = page();
      result.dialogs[0].peer.channel_id = id;
      result.chats[0] = channel(id, 'existing');
      return result;
    }
    return response(request);
  };
  const following = harness(handle);
  const result = await runFollowCli(
    [`t.me/c/${id}/10`, '-d', '0', '-j'],
    following.io
  );
  assert.equal(result.result.outcomes[0].status, 'alreadyMember');
  assert.equal(following.calls.length, 1);
  const leaving = harness(handle);
  await runFollowCli(['leave', `-100${id}`, '-j'], leaving.io);
  const request = leaving.calls.find(
    (value) => value._ === 'channels.leaveChannel'
  );
  assert.equal(request.channel.channel_id, id);
  assert.equal(request.channel.access_hash, -id);
});
