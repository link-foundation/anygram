import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Anygram, createAdapter } from '../src/index.js';
import { RpcOperations } from '../src/operations.js';

it('resolves cached Peer constructors and fetches uncached InputPeer entities', async () => {
  const calls = [];
  const operations = new RpcOperations(async (request) => {
    calls.push(request);
    assert.equal(request.method, 'users.getUsers');
    return [{ _: 'user', id: 7n, access_hash: 11n, first_name: 'Ada' }];
  });
  operations.remember({
    users: [{ _: 'user', id: 42n, access_hash: 19n }],
    chats: [{ _: 'channel', id: 9n, access_hash: 23n }],
  });
  assert.deepEqual(
    await operations.resolvePeer({ _: 'peerUser', user_id: 42n }),
    {
      _: 'inputPeerUser',
      user_id: 42n,
      access_hash: 19n,
    }
  );
  assert.deepEqual(
    await operations.resolvePeer({ _: 'peerChannel', channel_id: 9n }),
    {
      _: 'inputPeerChannel',
      channel_id: 9n,
      access_hash: 23n,
    }
  );
  assert.deepEqual(
    await operations.resolvePeer({ _: 'peerChat', chat_id: 3n }),
    {
      _: 'inputPeerChat',
      chat_id: 3n,
    }
  );
  const entity = await operations.getEntity({
    _: 'inputPeerUser',
    user_id: 7n,
    access_hash: 11n,
  });
  assert.equal(entity.first_name, 'Ada');
  assert.equal(calls.length, 1);
  assert.equal((await operations.getEntity(7n)).first_name, 'Ada');
  await assert.rejects(
    operations.resolvePeer({ _: 'peerUser', user_id: 8n }),
    /access hash/i
  );
});

it('lists contacts and empty-chat greeting stickers over a raw-only backend', async () => {
  const calls = [];
  const client = new Anygram({
    adapters: [
      createAdapter('mtproto', {
        call: async (method, params) => {
          calls.push({ method, params });
          return method === 'contacts.getContacts'
            ? { _: 'contacts.contacts', contacts: [], users: [] }
            : {
                _: 'messages.stickers',
                stickers: [{ _: 'document', id: 17n }],
              };
        },
      }),
    ],
  });
  assert.deepEqual((await client.getContacts()).contacts, []);
  assert.equal((await client.getGreetingStickers())[0].id, 17n);
  assert.equal(calls[1].params.emoticon, '👋⭐️');
  assert.equal(calls[1].params.hash, 0n);
  assert.equal((await client.getInputEntity('me'))._, 'inputPeerSelf');
});

describe('shared MTProto operations', () => {
  it('resolves usernames and sends without losing IDs through a raw-only backend', async () => {
    const calls = [];
    const client = new Anygram({
      adapters: [
        createAdapter('mtproto', {
          call: async (method, params) => {
            calls.push({ method, params });
            if (method === 'contacts.resolveUsername') {
              return {
                _: 'contacts.resolvedPeer',
                peer: { _: 'peerUser', user_id: 9007199254740993n },
                users: [
                  {
                    _: 'user',
                    id: 9007199254740993n,
                    access_hash: -17n,
                    username: 'testuser',
                  },
                ],
                chats: [],
              };
            }
            return {
              _: 'updates',
              updates: [],
              users: [],
              chats: [],
              date: 1,
              seq: 1,
            };
          },
        }),
      ],
    });
    await client.sendMessage('@testuser', 'hello');
    await client.sendMessage('@testuser', { message: 'again', silent: true });
    assert.equal(calls.length, 3);
    assert.equal(calls[1].params.peer.user_id, 9007199254740993n);
    assert.equal(calls[1].params.peer.access_hash, -17n);
    assert.equal(typeof calls[1].params.random_id, 'bigint');
    assert.equal(calls[2].params.silent, true);
    assert.notEqual(calls[1].params.random_id, calls[2].params.random_id);
  });

  it('searches channel history through MTProto for community-posts', async () => {
    const client = new Anygram({
      adapters: [
        createAdapter('mtproto', {
          call: async (method, params) => {
            assert.equal(method, 'messages.search');
            assert.equal(params.peer._, 'inputPeerSelf');
            assert.equal(params.q, 'needle');
            assert.equal(params.filter._, 'inputMessagesFilterEmpty');
            return {
              messages: [{ id: 12, message: 'needle' }],
              users: [],
              chats: [],
            };
          },
        }),
      ],
    });
    assert.equal((await client.searchMessages('me', 'needle'))[0].id, 12);
  });

  it('bounds history pagination and stops when a server repeats a page', async () => {
    let calls = 0;
    const client = new Anygram({
      adapters: [
        createAdapter('mtproto', {
          call: async () => {
            calls++;
            return { messages: [{ id: 2 }, { id: 1 }], users: [], chats: [] };
          },
        }),
      ],
    });
    const messages = [];
    for await (const message of client.iterMessages('me', {
      limit: 4,
      pageSize: 2,
    })) {
      messages.push(message.id);
    }
    assert.deepEqual(messages, [2, 1]);
    assert.equal(calls, 2);
  });
  it('rejects fractional pagination limits before invoking a backend', async () => {
    const client = new Anygram({
      adapters: [
        createAdapter('mtproto', {
          call: () => assert.fail('invalid limit reached backend'),
        }),
      ],
    });
    await assert.rejects(async () => {
      for await (const value of client.iterMessages('me', { limit: 0.5 })) {
        void value;
      }
    }, /Invalid history pagination/);
  });
});
