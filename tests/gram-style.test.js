import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { Dialog as GramDialog } from 'telegram/tl/custom/dialog.js';
import { Dialog as TeleDialog } from 'teleproto/tl/custom/dialog.js';
import { Anygram, createAdapter } from '../src/index.js';
import { gramRequest, requestOf } from '../src/requests.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

function page() {
  return {
    _: 'messages.dialogs',
    dialogs: ['Channel', 'Chat', 'User'].map((type) => ({
      _: 'dialog',
      peer: { _: `peer${type}`, [`${type.toLowerCase()}_id`]: 7n },
      top_message: 10,
      read_inbox_max_id: 0,
      read_outbox_max_id: 0,
      unread_count: 2,
      unread_mentions_count: 1,
      unread_reactions_count: 0,
      unread_poll_votes_count: 0,
      notify_settings: { _: 'peerNotifySettings' },
      ...(type === 'Channel' ? { folder_id: 1, pinned: true } : {}),
    })),
    messages: ['Channel', 'Chat', 'User'].map((type) => ({
      _: 'message',
      peer_id: { _: `peer${type}`, [`${type.toLowerCase()}_id`]: 7n },
      id: 10,
      date: 123,
      message: `Top ${type}`,
    })),
    chats: [
      {
        _: 'channel',
        id: 7n,
        access_hash: -7n,
        title: 'Channel',
        username: 'channel',
        megagroup: true,
        photo: { _: 'chatPhotoEmpty' },
        date: 1,
      },
      {
        _: 'chat',
        id: 7n,
        title: 'Chat',
        participants_count: 3,
        photo: { _: 'chatPhotoEmpty' },
        date: 1,
        version: 1,
      },
    ],
    users: [{ _: 'user', id: 7n, access_hash: 17n, first_name: 'Ada' }],
  };
}

function routedClient(handle) {
  return new Anygram({
    adapters: [createAdapter('mtproto', { call: handle })],
  });
}

for (const [label, Api, Dialog] of [
  ['GramJS', GramApi, GramDialog],
  ['teleproto', TeleApi, TeleDialog],
]) {
  it(`matches ${label} dialog fields using the shared paginated account path`, async () => {
    const input = page();
    const reply = gramRequest(Api, requestOf(input));
    const entities = new Map([
      ['-1007', reply.chats[0]],
      ['-7', reply.chats[1]],
      ['7', reply.users[0]],
    ]);
    const expected = reply.dialogs.map(
      (dialog, index) => new Dialog({}, dialog, entities, reply.messages[index])
    );
    const client = routedClient(async (method) => {
      assert.equal(method, 'messages.getDialogs');
      return reply;
    });
    const dialogs = await client.gramjs.getDialogs();
    assert(Array.isArray(dialogs));
    assert.equal(dialogs.length, 3);
    for (let index = 0; index < dialogs.length; index++) {
      for (const field of [
        'pinned',
        'folderId',
        'archived',
        'date',
        'name',
        'title',
        'unreadCount',
        'unreadMentionsCount',
        'isUser',
        'isGroup',
        'isChannel',
      ]) {
        assert.equal(dialogs[index][field], expected[index][field], field);
      }
      assert.equal(dialogs[index].id.toString(), expected[index].id.toString());
      assert.equal(
        dialogs[index].entity.className,
        expected[index].entity.className
      );
      assert.equal(
        dialogs[index].inputEntity.className,
        expected[index].inputEntity.className
      );
      assert.equal(
        dialogs[index].message.message,
        expected[index].message.message
      );
    }
    dialogs[0].entity.accessHash = 0n;
    assert.equal(reply.chats[0].accessHash.toString(), '-7');
    assert.equal((await client.gramjs.getInputEntity('-1007')).accessHash, -7n);
    assert.notEqual(client.teleproto, client.gramjs);
  });
}

it('exposes entity and message camelCase views while preserving the raw result', async () => {
  const raw = page();
  const client = routedClient(async (method) => {
    if (method === 'users.getUsers') {
      return raw.users;
    }
    if (method === 'messages.getHistory') {
      return {
        _: 'messages.messages',
        messages: [10, 9, 8].map((id) => ({ ...raw.messages[0], id })),
        chats: raw.chats,
        users: raw.users,
      };
    }
    return raw;
  });
  const me = await client.gramjs.getMe();
  assert.equal(me.className, 'User');
  assert.equal(me.firstName, 'Ada');
  await client.gramjs.getDialogs();
  assert.equal((await client.gramjs.getEntity('-1007')).accessHash, -7n);
  const messages = await client.gramjs.getMessages('-1007', { limit: 3 });
  assert.equal(messages[0].peerId.className, 'PeerChannel');
  assert.equal(messages[0].peerId.channelId, 7n);
  assert.equal(raw.messages[0].peer_id.channel_id, 7n);
  assert.equal(raw.messages[0].className, undefined);
  const streamed = [];
  for await (const message of client.gramjs.iterMessages('-1007', {
    limit: 2,
  })) {
    streamed.push(message);
  }
  assert.equal(streamed.length, 2);
});

it('streams detached dialog views and keeps unsupported extended models explicit', async () => {
  const raw = page();
  raw.messages = [];
  const client = routedClient(async () => raw);
  const seen = [];
  for await (const dialog of client.gramjs.iterDialogs({ limit: 2 })) {
    seen.push(dialog);
  }
  assert.equal(seen.length, 2);
  assert.equal(seen[0].message, undefined);
  assert.equal(seen[0].date, undefined);
  assert.equal(seen[0].draft, undefined);
  assert.equal(seen[0].sendMessage, undefined);
  assert.equal(seen[0].entity.id, 7n);
});

for (const [kind, Api] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`paginates ${kind} migration views through actual request constructors`, async () => {
    const calls = [];
    const first = page();
    first._ = 'messages.dialogsSlice';
    first.count = 3;
    first.dialogs = first.dialogs.slice(0, 2);
    first.messages = first.messages.slice(0, 2);
    first.users = [];
    const second = page();
    second.dialogs = second.dialogs.slice(1);
    const client = new Anygram({
      adapters: [
        createAdapter(
          kind,
          {
            getDialogs: () =>
              assert.fail('Shared pagination must use raw RPCs'),
            async invoke(request) {
              assert(request instanceof Api.messages.GetDialogs);
              assert(request.getBytes().length > 4);
              calls.push(request);
              return gramRequest(
                Api,
                requestOf(calls.length === 1 ? first : second)
              );
            },
          },
          { Api }
        ),
      ],
    });
    const dialogs = await client.gramjs.getDialogs({ pageSize: 2 });
    assert.equal(calls.length, 2);
    assert.equal(dialogs.length, 3);
    assert.equal(calls[1].offsetPeer.className, 'InputPeerChat');
    assert.equal(calls[1].offsetPeer.chatId.toString(), '7');
    assert.equal(dialogs[0].inputEntity.accessHash, -7n);
    assert.equal(dialogs[1].entity.participantsCount, 3);
    assert.equal(dialogs[2].entity.firstName, 'Ada');
  });
}

it('honors cancellation between yields without issuing a second dialog request', async () => {
  let calls = 0;
  const controller = new globalThis.AbortController();
  const client = routedClient(async () => {
    calls++;
    return page();
  });
  const iterator = client.gramjs.iterDialogs({ signal: controller.signal });
  assert.equal((await iterator.next()).value.entity.className, 'Channel');
  controller.abort(new Error('stop migration scan'));
  await assert.rejects(iterator.next(), /stop migration scan/);
  assert.equal(calls, 1);
});

it('executes dialog migration views over native encrypted TCP', async () => {
  const peer = await secretRpcPeer((request) => {
    assert.equal(request._, 'messages.getDialogs');
    return page();
  });
  try {
    const client = new Anygram({
      adapters: [createAdapter('mtproto', peer.client)],
    });
    const dialogs = await client.gramjs.getDialogs();
    assert.equal(dialogs[0].entity.className, 'Channel');
    assert.equal(dialogs[0].inputEntity.accessHash, -7n);
    assert.equal(dialogs[0].folderId, 1);
    assert.equal(dialogs[2].entity.firstName, 'Ada');
  } finally {
    await peer.close();
  }
});
