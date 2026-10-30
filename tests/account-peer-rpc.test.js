import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Anygram, Api, createAdapter } from '../src/index.js';
import { TlCodec } from '../src/tl.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { objectRequest, requestOf } from '../src/requests.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import { ownedMessage } from './fixtures/account-message-models.js';
import { peerPage, peerReply } from './fixtures/account-peers.js';

const codec = new TlCodec();
for (const type of ['User', 'Channel']) {
  for (const [style, Vendor] of [
    ['gramjs', GramApi],
    ['teleproto', TeleApi],
  ]) {
    it(`compares actual ${style} ${type} lookup bytes using a source-message constructor`, async () => {
      const { message, calls } = await ownedMessage(style, peerPage(type), () =>
        peerReply(type)
      );
      const origin = new Vendor.InputPeerUser({ userId: 9n, accessHash: 17n });
      const id = new Vendor[`Input${type}FromMessage`]({
        peer: origin,
        msgId: 7,
        [`${type.toLowerCase()}Id`]: 21n,
      });
      const expected =
        type === 'User'
          ? new Vendor.users.GetUsers({ id: [id] })
          : new Vendor.channels.GetChannels({ id: [id] });
      const forward = message.forward;
      const fetched =
        type === 'User' ? await forward.getSender() : await forward.getChat();
      assert.equal(fetched.accessHash, 23n);
      assert.equal((await message.getSender()).id, 21n);
      assert.equal(calls.length, 1);
      assert.deepEqual(
        codec.encode({ _: calls[0][0], ...calls[0][1] }),
        new Uint8Array(expected.getBytes())
      );
    });
  }
  for (const backend of [
    'gramjs',
    'teleproto',
    'mtcute',
    'mtproto',
    'native',
  ]) {
    it(`routes min ${type} refresh to exactly the selected ${backend} adapter`, async () => {
      const Vendor = backend === 'gramjs' ? GramApi : TeleApi;
      const calls = [];
      const execute = (value) => {
        const request = objectRequest(requestOf(value));
        calls.push(request);
        return request._ === 'messages.getHistory'
          ? peerPage(type)
          : peerReply(type);
      };
      const client = new Anygram({
        backend,
        adapters: [
          createAdapter(
            'unused',
            { call: () => assert.fail('wrong backend') },
            { kind: 'mtproto' }
          ),
          createAdapter(
            backend,
            {
              invoke: async (request) => {
                assert(
                  request instanceof Vendor.messages.GetHistory ||
                    request instanceof Vendor.users.GetUsers ||
                    request instanceof Vendor.channels.GetChannels
                );
                return execute(request);
              },
              call: async (method, params) =>
                execute(
                  typeof method === 'string' ? { _: method, ...params } : method
                ),
            },
            { Api: Vendor, kind: backend === 'native' ? 'mtproto' : backend }
          ),
        ],
      });
      const [message] = await client.teleproto.getMessages(
        new Api.InputPeerUser({ userId: 9n, accessHash: 17n })
      );
      assert.equal((await message.getSender()).accessHash, 23n);
      assert.equal(calls.length, 2);
      assert.equal(
        calls[1]._,
        type === 'User' ? 'users.getUsers' : 'channels.getChannels'
      );
      assert.equal(calls[1].id[0]._, `input${type}FromMessage`);
      assert.equal(calls[1].id[0].peer.access_hash, 17n);
    });
  }
  it(`retrieves min ${type} metadata over independent encrypted native TCP`, async () => {
    const calls = [];
    const peer = await secretRpcPeer((request) => {
      calls.push(request);
      return request._ === 'messages.getHistory'
        ? peerPage(type)
        : peerReply(type);
    });
    const client = new Anygram({
      adapters: [createAdapter('native', peer.client, { kind: 'mtproto' })],
    });
    try {
      const [message] = await client.gramjs.getMessages(
        new Api.InputPeerUser({ userId: 9n, accessHash: 17n })
      );
      assert.equal(message.inputSender._, `inputPeer${type}FromMessage`);
      assert.equal((await message.getSender()).accessHash, 23n);
      const forward = message.forward;
      assert.equal(
        (type === 'User' ? await forward.getSender() : await forward.getChat())
          .accessHash,
        23n
      );
      assert.equal(calls.length, 2);
      assert.equal(calls[1].id[0]._, `input${type}FromMessage`);
      assert.equal(calls[1].id[0].msg_id, 7);
      assert.equal(calls[1].id[0].peer.access_hash, 17n);
    } finally {
      await client.disconnect();
      await peer.close();
    }
  });
}
