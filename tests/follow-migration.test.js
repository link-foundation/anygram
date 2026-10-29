import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { Anygram, createAdapter } from '../src/index.js';
import { gramRequest, objectRequest, requestOf } from '../src/requests.js';
import { loadFollowScenario } from '../experiments/load-follow-scenario.mjs';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const migration = () => import('../examples/follow-client.js');
const group = (id, username) => ({
  _: 'channel',
  id,
  access_hash: -id,
  title: username,
  username,
  photo: { _: 'chatPhotoEmpty' },
  date: 1,
  megagroup: true,
});
const updates = (chats = []) => ({
  _: 'updates',
  updates: [],
  chats,
  users: [],
  date: 1,
  seq: 1,
});
function dialogs() {
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
    chats: [group(7n, 'existing')],
    users: [],
  };
}

function handle(request, calls) {
  calls.push(request);
  switch (request._) {
    case 'messages.getDialogs':
      return dialogs();
    case 'contacts.resolveUsername': {
      const id = request.username === 'existing' ? 7n : 8n;
      return {
        _: 'contacts.resolvedPeer',
        peer: { _: 'peerChannel', channel_id: id },
        chats: [group(id, request.username)],
        users: [],
      };
    }
    case 'account.getNotifySettings':
      return { _: 'peerNotifySettings', mute_until: 0 };
    case 'account.updateNotifySettings':
      return true;
    case 'folders.editPeerFolders':
      return updates();
    case 'channels.joinChannel':
      return {
        _: 'messages.chatInviteJoinResultOk',
        updates: updates([group(8n, 'fresh')]),
      };
    case 'messages.importChatInvite':
      return request.hash === 'Approval'
        ? {
            _: 'rpc_error',
            error_code: 400,
            error_message: 'INVITE_REQUEST_SENT',
          }
        : {
            _: 'messages.chatInviteJoinResultOk',
            updates: updates([group(9n, 'private')]),
          };
    default:
      assert.fail(`Unexpected migrated follow request ${request._}`);
  }
}

async function runScenario(client, calls) {
  const { FollowClient } = await migration();
  const bridge = new FollowClient(client, { scope: { cleanupDelay: 0 } });
  const follower = loadFollowScenario('TelegramFollower', bridge);
  const links = [
    't.me/existing',
    't.me/fresh',
    't.me/+Private',
    't.me/+Approval',
    't.me/c/7/10',
    'example.org/invalid',
  ];
  const result = await follower.followLinks(links, {
    mute: true,
    archive: true,
  });
  assert.deepEqual(result.joined, links.slice(1, 3));
  assert.deepEqual(result.alreadyMember, [links[0], links[4]]);
  assert.deepEqual(result.requestSent, [links[3]]);
  assert.deepEqual(result.invalid, [links[5]]);
  assert.equal(result.failed.length, 0);
  assert.equal(result.muted.length, 3);
  assert.equal(result.archived.length, 2);
  assert.equal(result.alreadyArchived.length, 1);
  assert.equal(
    calls.filter((r) => r._ === 'messages.importChatInvite').length,
    2
  );
  assert.equal(calls.filter((r) => r._ === 'channels.joinChannel').length, 1);
  const mute = calls.find((r) => r._ === 'account.updateNotifySettings');
  assert.equal(mute.settings.mute_until, 2147483647);
  assert.equal(mute.settings.show_previews, false);
  assert.equal(mute.settings.silent, true);
  assert.throws(() => bridge.getMe(), /not connected/);
}

for (const [kind, Api] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`executes pinned follow business logic through the ${kind} migration bridge`, async () => {
    const calls = [];
    const closed = [];
    const backend = {
      connect: async () => {},
      disconnect: async () => closed.push('disconnect'),
      destroy: async () => closed.push('destroy'),
      async invoke(request) {
        assert(request.getBytes().length > 4);
        const result = handle(objectRequest(requestOf(request)), calls);
        if (result._ === 'rpc_error') {
          throw new Error(result.error_message);
        }
        // GramJS's older schema predates the layer-232 join-result wrapper.
        const compatible =
          kind === 'gramjs' && result._ === 'messages.chatInviteJoinResultOk'
            ? result.updates
            : result;
        return typeof compatible === 'boolean'
          ? compatible
          : gramRequest(Api, requestOf(compatible));
      },
    };
    await runScenario(
      new Anygram({ adapters: [createAdapter(kind, backend, { Api })] }),
      calls
    );
    assert.deepEqual(closed, ['disconnect', 'destroy']);
  });
}

it('executes the pinned follow batch over native encrypted TCP and awaits closure', async () => {
  const calls = [];
  const peer = await secretRpcPeer((request) => handle(request, calls));
  try {
    await runScenario(
      new Anygram({ adapters: [createAdapter('mtproto', peer.client)] }),
      calls
    );
    assert.equal(peer.client.transport.closed, true);
  } finally {
    await peer.close();
  }
});

it('matches cached dialogs by peer kind as well as exact ID and validates bridge inputs', async () => {
  const { FollowClient } = await migration();
  let calls = 0;
  const backend = {
    connect: async () => {},
    disconnect: async () => {},
    call: async () => {
      calls++;
      return true;
    },
  };
  const bridge = new FollowClient(
    new Anygram({ adapters: [createAdapter('mtproto', backend)] })
  );
  const channel = group(7n, 'channel');
  const chat = { _: 'chat', id: 7n };
  await bridge.withConnection(async () => {
    const cache = [{ entity: chat }, { entity: channel }];
    assert.equal(
      (await bridge.getDialogByEntity(channel, cache)).entity,
      channel
    );
    assert.equal((await bridge.getDialogByEntity(chat, cache)).entity, chat);
    assert.equal(
      await bridge.getDialogByEntity({ _: 'user', id: 7n }, cache),
      null
    );
    await assert.rejects(bridge.editFolder(channel, 2), RangeError);
    await assert.rejects(bridge.getMessages(channel, 1001), RangeError);
    await assert.rejects(
      bridge.getDialogByEntity(
        { _: 'chat', id: Number.MAX_SAFE_INTEGER + 1 },
        cache
      ),
      RangeError
    );
    assert.equal(
      bridge.parseInviteLink('https://evil.example/t.me/fresh'),
      null
    );
    assert.equal(
      bridge.parseInviteLink('tg://privatepost?channel=9007199254740993&post=1')
        .channelId,
      '9007199254740993'
    );
  });
  assert.equal(calls, 0);
});

it('preserves the original operation failure and every exhausted cleanup cause', async () => {
  const { FollowClient } = await migration();
  const work = new Error('original work');
  const close = new Error('close failed');
  const bridge = new FollowClient(
    new Anygram({
      adapters: [
        createAdapter('mtproto', {
          connect: async () => {},
          disconnect: async () => {
            throw close;
          },
        }),
      ],
    }),
    { scope: { cleanupAttempts: 2, cleanupDelay: 0 } }
  );
  await assert.rejects(
    bridge.withConnection(() => {
      throw work;
    }),
    (error) => {
      assert(error instanceof globalThis.AggregateError);
      assert.equal(error.cause, work);
      assert.equal(error.errors[0], work);
      assert.equal(error.errors.length, 3);
      assert(error.errors.slice(1).every((failure) => failure.cause === close));
      return true;
    }
  );
  assert.throws(() => bridge.getMe(), /not connected/);
});

it('keeps connection cancellation active when a caller supplies a dialog signal', async () => {
  const { FollowClient } = await migration();
  const scope = new globalThis.AbortController();
  const child = new globalThis.AbortController();
  let calls = 0;
  const bridge = new FollowClient(
    new Anygram({
      adapters: [
        createAdapter('mtproto', {
          connect: async () => {},
          disconnect: async () => {},
          call: async () => {
            calls++;
            return dialogs();
          },
        }),
      ],
    }),
    { scope: { signal: scope.signal } }
  );
  await bridge.withConnection(async () => {
    scope.abort(new Error('scope cancelled'));
    await assert.rejects(
      bridge.getDialogs({ signal: child.signal }),
      /scope cancelled/
    );
  });
  assert.equal(calls, 0);
});

it('runs pinned join/list/leave commands and basic-chat leave through canonical operations', async () => {
  const { FollowClient } = await migration();
  const calls = [];
  const client = new Anygram({
    adapters: [
      createAdapter('mtproto', {
        connect: async () => {},
        disconnect: async () => {},
        async call(method, params) {
          if (
            ['channels.leaveChannel', 'messages.deleteChatUser'].includes(
              method
            )
          ) {
            calls.push({ _: method, ...params });
            return updates();
          }
          return handle({ _: method, ...params }, calls);
        },
      }),
    ],
  });
  const bridge = new FollowClient(client);
  const joiner = loadFollowScenario('TelegramGroupJoiner', bridge);
  await joiner.joinGroup('https://t.me/fresh');
  await joiner.listGroups({ json: true, verbose: true });
  await joiner.leaveGroup('@fresh');
  await bridge.withConnection(() => bridge.leaveChannel({ _: 'chat', id: 7n }));
  assert(calls.some((request) => request._ === 'channels.joinChannel'));
  assert(calls.some((request) => request._ === 'messages.getDialogs'));
  assert(calls.some((request) => request._ === 'channels.leaveChannel'));
  const deletion = calls.find(
    (request) => request._ === 'messages.deleteChatUser'
  );
  assert.equal(deletion.chat_id, 7n);
  assert.equal(deletion.user_id._, 'inputUserSelf');
});

it('covers wrapper account, raw request, message and notification helpers without swallowing errors', async () => {
  const { FollowClient } = await migration();
  const calls = [];
  const failure = new Error('settings unavailable');
  const client = new Anygram({
    adapters: [
      createAdapter('mtproto', {
        connect: async () => {},
        disconnect: async () => {},
        async call(method, params) {
          calls.push({ method, params });
          if (method === 'users.getUsers') {
            return [{ _: 'user', id: 1n, self: true, first_name: 'Ada' }];
          }
          if (method === 'account.getNotifySettings') {
            throw failure;
          }
          if (method === 'help.getNearestDc') {
            return { _: 'nearestDc', country: 'US', this_dc: 2, nearest_dc: 2 };
          }
          if (method === 'messages.getHistory') {
            return {
              _: 'messages.messages',
              messages: [
                {
                  _: 'message',
                  id: 2,
                  peer_id: { _: 'peerChannel', channel_id: 7n },
                  message: 'hello',
                  date: 1,
                },
              ],
              chats: [],
              users: [],
            };
          }
          return updates();
        },
      }),
    ],
  });
  const bridge = new FollowClient(client);
  await bridge.withConnection(async (view) => {
    assert.equal((await bridge.getMe()).firstName, 'Ada');
    assert.equal((await view.getMe()).className, 'User');
    assert.equal(
      (await bridge.invoke({ _: 'help.getNearestDc' })).className,
      'NearestDc'
    );
    assert.equal(
      (await bridge.sendMessage('me', 'hello')).className,
      'Updates'
    );
    assert.equal(
      (await bridge.getMessages(group(7n, 'existing'), 2))[0].peerId.channelId,
      7n
    );
    await assert.rejects(
      bridge.getNotifySettings(group(7n, 'existing')),
      (error) => error.cause === failure
    );
    await bridge.updateNotificationSettings(group(7n, 'existing'), false);
    await bridge.editFolder(group(7n, 'existing'), 0);
  });
  const settings = calls.find(
    (call) => call.method === 'account.updateNotifySettings'
  );
  assert.equal(settings.params.settings.mute_until, 0);
  assert.equal(settings.params.settings.silent, false);
  const folder = calls.find(
    (call) => call.method === 'folders.editPeerFolders'
  );
  assert.equal(folder.params.folder_peers[0].folder_id, 0);
});
