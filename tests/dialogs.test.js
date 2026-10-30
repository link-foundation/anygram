import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api } from 'telegram';
import { Api as TeleprotoApi } from 'teleproto';
import { TlBinaryWriter } from '@mtcute/tl-runtime';
import { __tlWriterMap } from '../node_modules/@mtcute/core/tl/binary/writer.js';
import { Anygram, createAdapter } from '../src/index.js';
import { RpcOperations } from '../src/operations.js';
import { TlCodec } from '../src/tl.js';
import { gramRequest, requestOf } from '../src/requests.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const peer = (type, id) => ({
  _: `peer${type}`,
  [`${type.toLowerCase()}_id`]: id,
});
const entity = (type, id) => ({
  _: type,
  id,
  access_hash: -id,
  title: `Channel ${id}`,
  photo: { _: 'chatPhotoEmpty' },
  date: 1,
});
const dialog = (type, id, top, extra) => ({
  _: 'dialog',
  peer: peer(type, id),
  top_message: top,
  read_inbox_max_id: 0,
  read_outbox_max_id: 0,
  unread_count: 0,
  unread_mentions_count: 0,
  unread_reactions_count: 0,
  unread_poll_votes_count: 0,
  notify_settings: { _: 'peerNotifySettings' },
  ...extra,
});
const message = (type, id, top, date) => ({
  _: 'message',
  peer_id: peer(type, id),
  id: top,
  date,
  message: `Top ${type} ${id}`,
});
function pages() {
  return [
    {
      _: 'messages.dialogsSlice',
      count: 4,
      dialogs: [
        dialog('Channel', 7n, 10, { pinned: true }),
        dialog('User', 7n, 10),
      ],
      messages: [message('User', 7n, 10, 30), message('Channel', 7n, 10, 20)],
      chats: [entity('channel', 7n)],
      users: [{ _: 'user', id: 7n, access_hash: 17n, first_name: 'Same ID' }],
    },
    {
      _: 'messages.dialogs',
      dialogs: [
        dialog('Channel', 8n, 9),
        dialog('Channel', 9n, 8, { folder_id: 1 }),
      ],
      messages: [message('Channel', 8n, 9, 10), message('Channel', 9n, 8, 5)],
      chats: [entity('channel', 8n), entity('channel', 9n)],
      users: [],
    },
  ];
}
async function collect(iterable) {
  const result = [];
  for await (const entry of iterable) {
    result.push(entry);
  }
  return result;
}

it('streams complete dialog pages with peer-qualified messages and the exact date/id/peer cursor', async () => {
  const replies = pages();
  const calls = [];
  const operations = new RpcOperations(async (request, options) => {
    calls.push({ request, options });
    return replies[calls.length - 1];
  });
  const controller = new globalThis.AbortController();
  const result = await collect(
    operations.iterDialogs({ pageSize: 2, signal: controller.signal })
  );
  assert.equal(result.length, 4);
  assert.equal(result[0].entity._, 'channel');
  assert.equal(result[0].message.message, 'Top Channel 7');
  assert.equal(result[1].message.message, 'Top User 7');
  assert.equal(result[3].dialog.folder_id, 1);
  assert.deepEqual(result[0].inputPeer, {
    _: 'inputPeerChannel',
    channel_id: 7n,
    access_hash: -7n,
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].request.params.limit, 2);
  assert.equal(calls[0].request.params.hash, 0n);
  assert.equal(calls[1].request.params.exclude_pinned, true);
  assert.deepEqual(calls[1].request.params.offset_peer, {
    _: 'inputPeerUser',
    user_id: 7n,
    access_hash: 17n,
  });
  assert.equal(calls[1].request.params.offset_id, 10);
  assert.equal(calls[1].request.params.offset_date, 30);
  assert.equal(calls[1].options.signal, controller.signal);
  assert.equal((await operations.resolvePeer('-1009')).channel_id, 9n);
});

it('bounds dialog requests and deduplicates overlapping peers rather than colliding numeric IDs', async () => {
  const replies = pages();
  replies[1].dialogs.unshift(replies[0].dialogs[1]);
  replies[1].users = replies[0].users;
  let count = 0;
  const operations = new RpcOperations(
    async () => replies[Math.min(count++, 1)]
  );
  const result = await collect(
    operations.iterDialogs({ pageSize: 2, limit: 3 })
  );
  assert.equal(count, 2);
  assert.equal(result.length, 3);
  count = 0;
  const repeated = new RpcOperations(async () => {
    count++;
    return pages()[0];
  });
  assert.equal(
    (await collect(repeated.iterDialogs({ pageSize: 2 }))).length,
    2
  );
  assert.equal(count, 2);
  count = 0;
  const forever = new RpcOperations(async () => {
    count++;
    const result = pages()[0];
    result.dialogs = [dialog('Channel', BigInt(count), count)];
    result.chats = [entity('channel', BigInt(count))];
    result.messages = [message('Channel', BigInt(count), count, count)];
    return result;
  });
  await assert.rejects(
    collect(forever.iterDialogs({ pageSize: 1, maxPages: 2 })),
    { type: 'DIALOG_PAGE_LIMIT' }
  );
  assert.equal(count, 2);
});

it('supports explicit folders and cursors, empty histories and missing entities without fabricating access hashes', async () => {
  const operations = new RpcOperations(async (request) => {
    assert.equal(request.params.folder_id, 1);
    assert.equal(request.params.offset_date, 22);
    assert.equal(request.params.offset_id, 4);
    assert.equal(request.params.offset_peer._, 'inputPeerSelf');
    assert.equal(request.params.exclude_pinned, true);
    return {
      _: 'messages.dialogs',
      dialogs: [
        { _: 'dialogFolder' },
        dialog('User', 1n, 0),
        dialog('Channel', 2n, 1),
      ],
      messages: [],
      users: [{ _: 'user', self: true, id: 1n }],
      chats: [],
    };
  });
  const result = await collect(
    operations.iterDialogs({
      folderId: 1,
      offsetDate: 22,
      offsetId: 4,
      offsetPeer: { _: 'inputPeerSelf' },
      excludePinned: true,
    })
  );
  assert.equal(result.length, 1);
  assert.equal(result[0].message, undefined);
  assert.equal(result[0].inputPeer._, 'inputPeerSelf');
});

it('validates dialog limits before invocation and stops fetching after iterator closure or cancellation', async () => {
  const calls = [];
  const operations = new RpcOperations(async (request) => {
    calls.push(request);
    return pages()[0];
  });
  for (const options of [
    { limit: -1 },
    { limit: 0.1 },
    { pageSize: 0 },
    { pageSize: 101 },
    { maxPages: 0 },
    { maxPages: Infinity },
    { maxPages: 10001 },
    { offsetId: -1 },
    { offsetDate: -1 },
    { folderId: 2 },
  ]) {
    await assert.rejects(collect(operations.iterDialogs(options)), RangeError);
  }
  assert.deepEqual(await collect(operations.iterDialogs({ limit: 0 })), []);
  assert.equal(calls.length, 0);
  for await (const entry of operations.iterDialogs({ pageSize: 2 })) {
    assert.equal(entry.entity.id, 7n);
    break;
  }
  assert.equal(calls.length, 1);
  const controller = new globalThis.AbortController();
  const iterator = operations.iterDialogs({
    pageSize: 2,
    signal: controller.signal,
  });
  await iterator.next();
  controller.abort(new Error('stop dialog scan'));
  await assert.rejects(iterator.next(), /stop dialog scan/);
  assert.equal(calls.length, 2);
});

it('rejects malformed page vectors and propagates server errors without repeating requests', async () => {
  for (const result of [
    null,
    {},
    { _: 'messages.dialogs', dialogs: true },
    { _: 'messages.dialogs', dialogs: [], messages: null },
  ]) {
    const operations = new RpcOperations(async () => result);
    await assert.rejects(collect(operations.iterDialogs()), /dialog response/i);
  }
  const error = Object.assign(new Error('FLOOD_WAIT_42'), { code: 420 });
  let count = 0;
  const operations = new RpcOperations(async () => {
    count++;
    throw error;
  });
  await assert.rejects(
    collect(operations.iterDialogs()),
    (value) => value === error
  );
  assert.equal(count, 1);
  const cached = new RpcOperations(async () => ({
    _: 'messages.dialogsNotModified',
    count: 2,
  }));
  assert.deepEqual(await collect(cached.iterDialogs()), []);
});

it('keeps dialog cursors and cached access hashes private when consumers mutate yielded entries', async () => {
  const replies = pages();
  let count = 0;
  const operations = new RpcOperations(async (request) => {
    if (count === 1) {
      assert.equal(request.params.offset_id, 10);
      assert.equal(request.params.offset_date, 30);
      assert.equal(request.params.offset_peer.user_id, 7n);
      assert.equal(request.params.offset_peer.access_hash, 17n);
    }
    return replies[count++];
  });
  const iterator = operations.iterDialogs({ pageSize: 2 });
  const first = (await iterator.next()).value;
  const last = (await iterator.next()).value;
  first.entity.access_hash = 999n;
  last.inputPeer.user_id = 999n;
  last.inputPeer.access_hash = 999n;
  last.dialog.top_message = 999;
  last.message.date = 999;
  assert.equal((await iterator.next()).value.entity.id, 8n);
  assert.equal((await operations.resolvePeer('-1007')).access_hash, -7n);
  await iterator.return();
});

for (const [kind, BackendApi] of [
  ['gramjs', Api],
  ['teleproto', TeleprotoApi],
]) {
  it(`reroutes canonical dialog pagination through ${kind} with actual request/response constructors`, async () => {
    const requests = [];
    const client = new Anygram({
      adapters: [
        createAdapter(
          kind,
          {
            iterDialogs: () =>
              assert.fail('canonical iterator bypassed shared pagination'),
            invoke: async (request) => {
              assert.ok(request instanceof BackendApi.messages.GetDialogs);
              requests.push(request);
              const expected = new TlCodec().encode({
                _: 'messages.getDialogs',
                ...{
                  offset_date: request.offsetDate,
                  offset_id: request.offsetId,
                  offset_peer: { _: 'inputPeerEmpty' },
                  limit: request.limit,
                  hash: 0n,
                },
              });
              assert.deepEqual(Buffer.from(expected), request.getBytes());
              return gramRequest(BackendApi, requestOf(pages()[0]));
            },
          },
          { Api: BackendApi }
        ),
      ],
    });
    const result = await collect(client.iterDialogs({ limit: 2 }));
    assert.equal(result.length, 2);
    assert.equal(requests.length, 1);
  });
}

it('streams canonical dialogs through mtcute with actual request bytes and camelCase response peers', async () => {
  const client = new Anygram({
    adapters: [
      createAdapter('mtcute', {
        call: async (request) => {
          assert.deepEqual(
            TlBinaryWriter.serializeObject(__tlWriterMap, request),
            new TlCodec().encode({
              _: 'messages.getDialogs',
              offset_date: 0,
              offset_id: 0,
              offset_peer: { _: 'inputPeerEmpty' },
              limit: 100,
              hash: 0n,
            })
          );
          return {
            _: 'messages.dialogs',
            dialogs: [
              {
                _: 'dialog',
                peer: { _: 'peerChannel', channelId: 7 },
                topMessage: 10,
              },
            ],
            messages: [
              {
                _: 'message',
                id: 10,
                peerId: { _: 'peerChannel', channelId: 7 },
                date: 20,
                message: 'mtcute',
              },
            ],
            users: [],
            chats: [{ _: 'channel', id: 7, accessHash: request.hash }],
          };
        },
      }),
    ],
  });
  const result = await collect(client.iterDialogs());
  assert.equal(result[0].message.message, 'mtcute');
  assert.equal(result[0].inputPeer.access_hash, 0n);
});

it('streams native encrypted TCP dialog pages and reuses returned access hashes for account operations', async () => {
  const requests = [];
  const replies = pages();
  const peer = await secretRpcPeer((request) => {
    requests.push(request._);
    if (request._ === 'messages.getDialogs') {
      return replies.shift();
    }
    if (request._ === 'channels.joinChannel') {
      assert.equal(request.channel.access_hash, -9n);
      return {
        _: 'messages.chatInviteJoinResultOk',
        updates: {
          _: 'updates',
          updates: [],
          chats: [],
          users: [],
          date: 10,
          seq: 1,
        },
      };
    }
    if (request._ === 'account.updateNotifySettings') {
      assert.equal(request.peer.peer.channel_id, 9n);
      assert.equal(request.settings.mute_until, 2147483647);
      return true;
    }
    assert.equal(request._, 'folders.editPeerFolders');
    assert.equal(request.folder_peers[0].peer.access_hash, -9n);
    assert.equal(request.folder_peers[0].folder_id, 1);
    return {
      _: 'updates',
      updates: [],
      chats: [],
      users: [],
      date: 10,
      seq: 2,
    };
  });
  try {
    const client = new Anygram({
      adapters: [createAdapter('mtproto', peer.client)],
    });
    assert.equal(
      (await collect(client.iterDialogs({ pageSize: 2 }))).length,
      4
    );
    await client.joinChat('-1009');
    await client.muteChat('-1009');
    await client.archiveChat('-1009');
    assert.deepEqual(requests, [
      'messages.getDialogs',
      'messages.getDialogs',
      'channels.joinChannel',
      'account.updateNotifySettings',
      'folders.editPeerFolders',
    ]);
  } finally {
    await peer.close();
  }
});
