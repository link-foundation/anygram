import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api } from 'telegram';
import { Api as TeleprotoApi } from 'teleproto';
import { TlBinaryWriter } from '@mtcute/tl-runtime';
import { __tlWriterMap } from '../node_modules/@mtcute/core/tl/binary/writer.js';
import { Anygram, createAdapter, TelegramError } from '../src/index.js';
import { RpcOperations } from '../src/operations.js';
import { gramRequest, requestOf } from '../src/requests.js';
import { mtcuteRequest } from '../src/mtcute.js';
import { TlCodec } from '../src/tl.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const group = (id, extra = {}) => ({
  _: 'channel',
  id,
  access_hash: -id,
  title: `Group ${id}`,
  photo: { _: 'chatPhotoEmpty' },
  date: 1,
  ...extra,
});
const update = (chats = []) => ({
  _: 'updates',
  updates: [],
  chats,
  users: [],
  date: 1,
  seq: 1,
});
const joinResult = (chats = []) => ({
  _: 'messages.chatInviteJoinResultOk',
  updates: update(chats),
});
function dialogPage() {
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
        folder_id: 1,
      },
    ],
    messages: [],
    chats: [group(7n, { username: 'existing' })],
    users: [],
  };
}
const workflow = () => import('../examples/follow-groups.js');
function rawClient(handle) {
  return new Anygram({
    adapters: [createAdapter('mtproto', { call: handle })],
  });
}

it('reads and updates complete notification preferences, preserving explicit false flags and independent wire bytes', async () => {
  const requests = [];
  const operations = new RpcOperations(async (request) => {
    requests.push(request);
    return request.method === 'account.getNotifySettings'
      ? { _: 'peerNotifySettings', mute_until: 0, silent: false }
      : true;
  });
  const peer = { _: 'inputPeerChannel', channel_id: 7n, access_hash: -7n };
  assert.equal((await operations.getNotifySettings(peer)).mute_until, 0);
  await operations.muteChat(peer, {
    until: 0,
    showPreviews: true,
    silent: false,
    sound: { _: 'notificationSoundNone' },
    storiesMuted: false,
    storiesHideSender: true,
    storiesSound: { _: 'notificationSoundDefault' },
  });
  const settings = requests[1].params.settings;
  assert.deepEqual(settings, {
    _: 'inputPeerNotifySettings',
    mute_until: 0,
    show_previews: true,
    silent: false,
    sound: { _: 'notificationSoundNone' },
    stories_muted: false,
    stories_hide_sender: true,
    stories_sound: { _: 'notificationSoundDefault' },
  });
  const codec = new TlCodec();
  for (const request of requests) {
    assert.deepEqual(
      codec.encode({ _: request.method, ...request.params }),
      new Uint8Array(gramRequest(TeleprotoApi, request).getBytes())
    );
  }
  await operations.getNotifySettings({ _: 'inputNotifyBroadcasts' });
  assert.equal(requests[2].params.peer._, 'inputNotifyBroadcasts');
});

it('inspects invites without joining and caches the exact already-member or preview chat', async () => {
  const requests = [];
  const operations = new RpcOperations(async (request) => {
    requests.push(request);
    return { _: 'chatInviteAlready', chat: group(9n) };
  });
  assert.equal((await operations.checkChatInvite('AbC_123-X')).chat.id, 9n);
  assert.equal((await operations.getInputEntity('-1009')).access_hash, -9n);
  assert.equal(requests[0].method, 'messages.checkChatInvite');
  assert.deepEqual(
    new TlCodec().encode({ _: requests[0].method, ...requests[0].params }),
    new Uint8Array(gramRequest(TeleprotoApi, requests[0]).getBytes())
  );
  operations.remember({ _: 'chatInvitePeek', chat: group(10n), expires: 20 });
  assert.equal((await operations.getInputEntity('-10010')).access_hash, -10n);
});

it('rejects invalid invite hashes and notification values before resolving a username or sending RPCs', async () => {
  const operations = new RpcOperations(() =>
    assert.fail('invalid settings reached RPC')
  );
  for (const hash of ['', 'has space', 'a/b', undefined, 'a'.repeat(4097)]) {
    await assert.rejects(
      async () => operations.checkChatInvite(hash),
      TypeError
    );
  }
  for (const options of [
    { until: 0.5 },
    { until: 2147483648 },
    { until: -2147483649 },
    { showPreviews: 1 },
    { silent: 'false' },
    { storiesMuted: null },
  ]) {
    await assert.rejects(operations.muteChat('@Unknown', options), TypeError);
  }
});

it('owns nested notification preferences before asynchronous peer resolution', async () => {
  let resolveLookup;
  let sent;
  const operations = new RpcOperations((request) => {
    if (request.method === 'contacts.resolveUsername') {
      return new Promise((resolve) => {
        resolveLookup = resolve;
      });
    }
    sent = request.params.settings;
    return true;
  });
  const sound = {
    _: 'notificationSoundLocal',
    title: 'Original',
    data: 'original.ogg',
  };
  const pending = operations.muteChat('@newgroup', { sound });
  sound.data = 'mutated.ogg';
  resolveLookup({
    _: 'contacts.resolvedPeer',
    peer: { _: 'peerChannel', channel_id: 8n },
    chats: [group(8n)],
    users: [],
  });
  await pending;
  assert.equal(sent.sound.data, 'original.ogg');
});

it('follows existing/public/private groups with separate join, approval and verification outcomes', async () => {
  const requests = [];
  const checked = new Map();
  const client = rawClient(async (method, params) => {
    requests.push({ method, params });
    switch (method) {
      case 'messages.getDialogs':
        return dialogPage();
      case 'account.getNotifySettings':
        return { _: 'peerNotifySettings', mute_until: -1 };
      case 'contacts.resolveUsername':
        return {
          _: 'contacts.resolvedPeer',
          peer: { _: 'peerChannel', channel_id: 8n },
          chats: [group(8n, { username: 'newgroup' })],
          users: [],
        };
      case 'channels.joinChannel':
        return joinResult([group(8n)]);
      case 'messages.checkChatInvite': {
        checked.set(params.hash, (checked.get(params.hash) ?? 0) + 1);
        return checked.get(params.hash) === 1
          ? { _: 'chatInvite', title: 'Private' }
          : { _: 'chatInviteAlready', chat: group(9n) };
      }
      case 'messages.importChatInvite':
        if (params.hash === 'Approval') {
          throw new TelegramError('INVITE_REQUEST_SENT', {
            type: 'INVITE_REQUEST_SENT',
          });
        }
        if (params.hash === 'Verify') {
          return {
            _: 'messages.chatInviteJoinResultWebView',
            bot_id: 17n,
            query_id: 19n,
            users: [],
          };
        }
        return joinResult([group(999n), group(9n)]);
      case 'folders.editPeerFolders':
        return update();
      default:
        assert.fail(`unexpected ${method}`);
    }
  });
  const { followGroups } = await workflow();
  const result = await followGroups(
    client,
    [
      '@existing',
      'https://t.me/newgroup',
      'https://telegram.me/joinchat/Private',
      '+Approval',
      '+Verify',
      't.me/c/7/1',
      't.me/c/1234/1',
      't.me/newgroup/12',
    ],
    { mute: true, archive: true, now: () => 100 }
  );
  assert.deepEqual(
    result.outcomes.map((entry) => entry.status),
    [
      'alreadyMember',
      'joined',
      'joined',
      'requestSent',
      'verificationRequired',
      'alreadyMember',
      'inviteRequired',
      'alreadyMember',
    ]
  );
  assert.equal(result.outcomes[0].settings.mute, 'unchanged');
  assert.equal(result.outcomes[0].settings.archive, 'unchanged');
  const archives = requests.filter(
    (entry) => entry.method === 'folders.editPeerFolders'
  );
  assert.deepEqual(
    archives.map((entry) => entry.params.folder_peers[0].peer.channel_id),
    [8n, 9n]
  );
  assert.equal(
    requests.filter((entry) => entry.method === 'channels.joinChannel').length,
    1
  );
  assert.equal(
    requests.filter((entry) => entry.method === 'messages.importChatInvite')
      .length,
    3
  );
  assert.equal(checked.get('Private'), 2);
  assert.equal(checked.get('Approval'), 1);
  assert.equal(checked.get('Verify'), 1);
  assert.equal(result.stop, undefined);
});

it('records completed side effects and stops a bounded batch on flood waits without replay or waiting', async () => {
  let joins = 0;
  let archives = 0;
  const client = rawClient(async (method) => {
    if (method === 'messages.getDialogs') {
      return dialogPage();
    }
    if (method === 'contacts.resolveUsername') {
      return {
        _: 'contacts.resolvedPeer',
        peer: { _: 'peerChannel', channel_id: 8n },
        chats: [group(8n)],
        users: [],
      };
    }
    if (method === 'channels.joinChannel') {
      joins++;
      return joinResult();
    }
    if (method === 'account.getNotifySettings') {
      return { _: 'peerNotifySettings', mute_until: 0 };
    }
    if (method === 'account.updateNotifySettings') {
      throw new TelegramError('FLOOD_WAIT_60', {
        type: 'FLOOD_WAIT_60',
        retryAfter: 60,
      });
    }
    if (method === 'folders.editPeerFolders') {
      archives++;
      return update();
    }
    assert.fail(method);
  });
  const { followGroups } = await workflow();
  const result = await followGroups(client, ['@newgroup', '@other'], {
    mute: true,
    archive: true,
  });
  assert.equal(result.outcomes.length, 1);
  assert.equal(result.outcomes[0].status, 'joined');
  assert.equal(result.outcomes[0].settings.mute, 'failed');
  assert.equal(result.outcomes[0].phase, 'mute');
  assert.equal(result.stop.retryAfter, 60);
  assert.equal(joins, 1);
  assert.equal(archives, 0);
});

it('keeps non-retryable and capacity failures explicit and bounds all inputs before network work', async () => {
  const { followGroups } = await workflow();
  const calls = [];
  const client = rawClient(async (method) => {
    calls.push(method);
    if (method === 'messages.getDialogs') {
      return dialogPage();
    }
    if (method === 'messages.checkChatInvite') {
      return { _: 'chatInvite', title: 'Group' };
    }
    throw new TelegramError('CHANNELS_TOO_MUCH', { type: 'CHANNELS_TOO_MUCH' });
  });
  await assert.rejects(
    followGroups(client, Array(1001).fill('+Hash')),
    RangeError
  );
  await assert.rejects(
    followGroups(client, ['+Hash'], { mute: 'true' }),
    TypeError
  );
  assert.equal(calls.length, 0);
  const result = await followGroups(client, [
    'https://evil.test/+Hash',
    '+First',
    '+Second',
  ]);
  assert.deepEqual(
    result.outcomes.map((entry) => entry.status),
    ['invalid', 'failed']
  );
  assert.equal(result.stop.type, 'CHANNELS_TOO_MUCH');
  assert.equal(
    calls.filter((method) => method === 'messages.importChatInvite').length,
    1
  );
});

it('does not configure a random chat from join updates when invite membership cannot be confirmed', async () => {
  const { followGroups } = await workflow();
  let joins = 0;
  const client = rawClient(async (method) => {
    if (method === 'messages.getDialogs') {
      return dialogPage();
    }
    if (method === 'messages.checkChatInvite') {
      return { _: 'chatInvite', title: 'Unknown' };
    }
    if (method === 'messages.importChatInvite') {
      joins++;
      return joinResult([group(99n)]);
    }
    assert.fail(`unconfirmed membership reached ${method}`);
  });
  const result = await followGroups(client, ['+Unknown'], {
    mute: true,
    archive: true,
  });
  assert.equal(result.outcomes[0].status, 'failed');
  assert.equal(result.outcomes[0].joinAccepted, true);
  assert.equal(result.outcomes[0].error.type, 'JOIN_MEMBERSHIP_UNCONFIRMED');
  assert.equal(joins, 1);
});

it('owns the bounded batch and settings before awaiting the initial membership scan', async () => {
  const { followGroups } = await workflow();
  let finishScan;
  const scan = new Promise((resolve) => {
    finishScan = resolve;
  });
  const client = {
    async *iterDialogs() {
      await scan;
      yield {
        entity: group(7n, { username: 'existing' }),
        inputPeer: { _: 'inputPeerChannel', channel_id: 7n, access_hash: -7n },
        dialog: {},
      };
    },
    getNotifySettings: () => assert.fail('caller changed requested settings'),
    resolvePeer: () => assert.fail('caller changed bounded destinations'),
  };
  const links = ['@existing'];
  const options = { mute: false, archive: false };
  const pending = followGroups(client, links, options);
  links[0] = '@other';
  links.push(...Array(1000).fill('@other'));
  options.mute = true;
  finishScan();
  const result = await pending;
  assert.equal(result.outcomes.length, 1);
  assert.equal(result.outcomes[0].link, '@existing');
  assert.equal(result.outcomes[0].status, 'alreadyMember');
  assert.equal(result.outcomes[0].settings.mute, 'notRequested');
});

it('can continue after a flood wait without waiting or replaying the failed join', async () => {
  const { followGroups } = await workflow();
  let joins = 0;
  const client = rawClient(async (method) => {
    if (method === 'messages.getDialogs') {
      return dialogPage();
    }
    if (method === 'contacts.resolveUsername') {
      return {
        _: 'contacts.resolvedPeer',
        peer: { _: 'peerChannel', channel_id: 8n },
        chats: [group(8n)],
        users: [],
      };
    }
    assert.equal(method, 'channels.joinChannel');
    joins++;
    throw new Error('FLOOD_WAIT_5');
  });
  const result = await followGroups(client, ['@newgroup', '@existing'], {
    continueOnFloodWait: true,
  });
  assert.equal(result.stop, undefined);
  assert.equal(result.outcomes.length, 2);
  assert.equal(result.outcomes[0].error.retryAfter, 5);
  assert.equal(result.outcomes[1].status, 'alreadyMember');
  assert.equal(joins, 1);
});

it('recognizes public username aliases by exact peer ID and avoids joining the same group twice', async () => {
  const { followGroups } = await workflow();
  let joins = 0;
  const client = rawClient(async (method) => {
    if (method === 'messages.getDialogs') {
      return dialogPage();
    }
    if (method === 'contacts.resolveUsername') {
      return {
        _: 'contacts.resolvedPeer',
        peer: { _: 'peerChannel', channel_id: 7n },
        chats: [group(7n)],
        users: [],
      };
    }
    joins++;
    return joinResult();
  });
  const result = await followGroups(client, ['@anothername']);
  assert.equal(result.outcomes[0].status, 'alreadyMember');
  assert.equal(joins, 0);
});

it('applies settings when membership races with the initial scan and the server reports already participating', async () => {
  const { followGroups } = await workflow();
  let checks = 0;
  let settings = 0;
  let joins = 0;
  const client = rawClient(async (method) => {
    if (method === 'messages.getDialogs') {
      return dialogPage();
    }
    if (method === 'messages.checkChatInvite') {
      return ++checks === 1
        ? { _: 'chatInvite', title: 'Group' }
        : { _: 'chatInviteAlready', chat: group(9n) };
    }
    if (method === 'messages.importChatInvite') {
      joins++;
      throw new TelegramError('USER_ALREADY_PARTICIPANT', {
        type: 'USER_ALREADY_PARTICIPANT',
      });
    }
    if (method === 'account.getNotifySettings') {
      return { _: 'peerNotifySettings', mute_until: 0 };
    }
    assert.equal(method, 'account.updateNotifySettings');
    settings++;
    return true;
  });
  const result = await followGroups(client, ['+Private'], { mute: true });
  assert.equal(result.outcomes[0].status, 'alreadyMember');
  assert.equal(result.outcomes[0].settings.mute, 'applied');
  assert.equal(settings, 1);
  assert.equal(joins, 1);
  assert.equal(checks, 2);
});

it('rejects a malformed invite preflight before attempting the membership side effect', async () => {
  const { followGroups } = await workflow();
  let joins = 0;
  const client = rawClient(async (method) => {
    if (method === 'messages.getDialogs') {
      return dialogPage();
    }
    if (method === 'messages.checkChatInvite') {
      return {};
    }
    joins++;
    return joinResult();
  });
  const result = await followGroups(client, ['+Private']);
  assert.equal(result.outcomes[0].status, 'failed');
  assert.equal(joins, 0);
});

it('propagates cancellation between accepted membership and settings without starting another side effect', async () => {
  const { followGroups } = await workflow();
  const controller = new globalThis.AbortController();
  const requests = [];
  const client = rawClient(async (method) => {
    requests.push(method);
    if (method === 'messages.getDialogs') {
      return dialogPage();
    }
    if (method === 'contacts.resolveUsername') {
      return {
        _: 'contacts.resolvedPeer',
        peer: { _: 'peerChannel', channel_id: 8n },
        chats: [group(8n)],
        users: [],
      };
    }
    assert.equal(method, 'channels.joinChannel');
    controller.abort(new Error('stop settings'));
    return joinResult();
  });
  await assert.rejects(
    followGroups(client, ['@newgroup'], {
      mute: true,
      archive: true,
      signal: controller.signal,
    }),
    /stop settings/
  );
  assert.equal(requests.length, 3);
});

it('supports group listing, recent history and leaving a private invite through the same shared client', async () => {
  const { listGroups, readGroup, leaveGroup } = await workflow();
  const requests = [];
  const client = rawClient(async (method, params) => {
    requests.push({ method, params });
    if (method === 'messages.getDialogs') {
      return dialogPage();
    }
    if (method === 'messages.checkChatInvite') {
      return { _: 'chatInviteAlready', chat: group(9n) };
    }
    if (method === 'messages.getHistory') {
      return {
        _: 'messages.messages',
        messages: [{ _: 'message', id: 12, message: 'history' }],
        chats: [],
        users: [],
      };
    }
    if (method === 'channels.leaveChannel') {
      return update();
    }
    assert.fail(method);
  });
  assert.equal((await listGroups(client))[0].entity.id, 7n);
  assert.equal(
    (await readGroup(client, 't.me/c/7/12', { limit: 3 }))[0].message,
    'history'
  );
  await leaveGroup(client, 'tg://join?invite=Private');
  assert.equal(requests.at(-1).params.channel.channel_id, 9n);
});

it('runs existing-member settings and private join verification over native encrypted TCP', async () => {
  const { followGroups } = await workflow();
  let checks = 0;
  const requests = [];
  const peer = await secretRpcPeer((request) => {
    requests.push(request._);
    if (request._ === 'messages.getDialogs') {
      return dialogPage();
    }
    if (request._ === 'messages.checkChatInvite') {
      return ++checks === 1
        ? { _: 'chatInvitePeek', chat: group(9n), expires: 200 }
        : { _: 'chatInviteAlready', chat: group(9n) };
    }
    if (request._ === 'messages.importChatInvite') {
      return joinResult([group(99n), group(9n)]);
    }
    if (request._ === 'account.getNotifySettings') {
      return { _: 'peerNotifySettings', mute_until: 0 };
    }
    if (request._ === 'account.updateNotifySettings') {
      assert.equal(request.settings.show_previews, false);
      assert.equal(request.settings.silent, true);
      return true;
    }
    assert.equal(request._, 'folders.editPeerFolders');
    assert.equal(request.folder_peers[0].peer.channel_id, 9n);
    return update();
  });
  try {
    const client = new Anygram({
      adapters: [createAdapter('mtproto', peer.client)],
    });
    const result = await followGroups(client, ['@existing', '+Private'], {
      mute: true,
      archive: true,
    });
    assert.deepEqual(
      result.outcomes.map((entry) => entry.status),
      ['alreadyMember', 'joined']
    );
    assert.equal(result.outcomes[0].settings.mute, 'applied');
    assert.equal(result.outcomes[1].settings.archive, 'applied');
    assert.equal(
      requests.filter((method) => method === 'messages.importChatInvite')
        .length,
      1
    );
    assert.equal(checks, 2);
  } finally {
    await peer.close();
  }
});

for (const [kind, BackendApi] of [
  ['gramjs', Api],
  ['teleproto', TeleprotoApi],
  ['mtcute'],
]) {
  it(`runs invite inspection and settings through the shared workflow with actual ${kind} serialization`, async () => {
    const { followGroups } = await workflow();
    const methods = [];
    const codec = new TlCodec();
    const invoke = async (request) => {
      const canonical = requestOf(request);
      const method = canonical.method;
      methods.push(method);
      if (BackendApi) {
        assert.deepEqual(
          new Uint8Array(request.getBytes()),
          codec.encode({ _: method, ...canonical.params })
        );
      } else {
        assert.deepEqual(
          TlBinaryWriter.serializeObject(__tlWriterMap, request),
          codec.encode({ _: method, ...canonical.params })
        );
      }
      let value;
      if (method === 'messages.getDialogs') {
        value = dialogPage();
      } else if (method === 'messages.checkChatInvite') {
        value = { _: 'chatInviteAlready', chat: group(9n) };
      } else if (method === 'account.getNotifySettings') {
        value = { _: 'peerNotifySettings', mute_until: 0 };
      } else {
        assert.equal(method, 'account.updateNotifySettings');
        return true;
      }
      return BackendApi
        ? gramRequest(BackendApi, requestOf(value))
        : mtcuteRequest(requestOf(value));
    };
    const backend = {
      invoke,
      call: invoke,
      iterDialogs: () =>
        assert.fail('backend iterator bypassed shared canonical pagination'),
      checkChatInvite: () =>
        assert.fail('backend invite helper bypassed canonical inspection'),
      getNotifySettings: () =>
        assert.fail('backend notification helper bypassed canonical settings'),
    };
    const client = new Anygram({
      adapters: [createAdapter(kind, backend, { Api: BackendApi })],
    });
    const result = await followGroups(client, ['+Private'], { mute: true });
    assert.equal(result.outcomes[0].status, 'alreadyMember');
    assert.equal(result.outcomes[0].settings.mute, 'applied');
    assert.deepEqual(methods, [
      'messages.getDialogs',
      'messages.checkChatInvite',
      'account.getNotifySettings',
      'account.updateNotifySettings',
    ]);
  });
}
