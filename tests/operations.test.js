import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Anygram, createAdapter } from '../src/index.js';

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
