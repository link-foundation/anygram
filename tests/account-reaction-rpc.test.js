import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Anygram, Api, createAdapter } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { objectRequest, requestOf } from '../src/requests.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import {
  messagePage,
  ownedMessage,
} from './fixtures/account-message-models.js';

const destination = {
  _: 'inputPeerChannel',
  channel_id: 31n,
  access_hash: 33n,
};
const reactionPage = () => ({
  _: 'messages.messageReactionsList',
  count: 0,
  reactions: [],
  users: [],
  chats: [],
  next_offset: 'cursor',
});
const response = (request) =>
  request._ === 'messages.getHistory'
    ? messagePage()
    : request._ === 'messages.getMessageReactionsList'
      ? reactionPage()
      : request._ === 'messages.forwardMessages'
        ? {
            _: 'updates',
            users: [],
            chats: [],
            date: 1,
            seq: 1,
            updates: [
              { _: 'updateMessageID', id: 11, random_id: request.random_id[0] },
              {
                _: 'updateNewChannelMessage',
                message: {
                  ...messagePage().messages[0],
                  id: 11,
                  peer_id: { _: 'peerChannel', channel_id: 31n },
                },
                pts: 1,
                pts_count: 1,
              },
            ],
          }
        : { _: 'updatesTooLong' };

for (const backend of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
  for (const helper of ['sendReaction', 'getReactionUsers', 'copy']) {
    it(`routes canonical ${helper} through only the selected ${backend} adapter`, async () => {
      const Vendor = backend === 'gramjs' ? GramApi : TeleApi;
      const calls = [];
      const execute = (value) => {
        const request = objectRequest(requestOf(value));
        calls.push(request);
        return response(request);
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
              sendReaction: () =>
                assert.fail('vendor helper bypassed canonical normalization'),
              getReactionUsers: () =>
                assert.fail('vendor helper bypassed canonical normalization'),
              invoke: async (request) => {
                assert.equal(typeof request.getBytes, 'function');
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
      const peer = new Api.InputPeerUser({ userId: 9n, accessHash: 17n });
      if (helper === 'copy') {
        const [message] = await client.teleproto.getMessages(peer);
        assert.equal((await message.copy(destination)).id, 11);
        assert.equal(calls.length, 2);
        assert.equal(calls[1].drop_author, true);
      } else if (helper === 'sendReaction') {
        await client.sendReaction(
          peer,
          7,
          ['👍', 9007199254740993n],
          true,
          false
        );
        assert.equal(calls.length, 1);
        assert.equal(calls[0].reaction[1].document_id, 9007199254740993n);
      } else {
        assert.equal(
          (
            await client.getReactionUsers(peer, 7, {
              reaction: '👍',
              limit: 2,
              offset: 'page',
            })
          ).next_offset,
          'cursor'
        );
        assert.equal(calls.length, 1);
        assert.equal(calls[0].reaction.emoticon, '👍');
        assert.equal(calls[0].offset, 'page');
      }
    });
  }
}

for (const style of ['gramjs', 'teleproto']) {
  for (const helper of ['react', 'getReactions', 'copy']) {
    it(`honors post-response ${style} ${helper} cancellation without another request`, async () => {
      const controller = new globalThis.AbortController();
      const reason = new Error('cancel after response');
      const { message, calls } = await ownedMessage(
        style,
        messagePage(),
        (method, params) => {
          controller.abort(reason);
          return response({ _: method, ...params });
        }
      );
      const options = { signal: controller.signal };
      const args =
        helper === 'react'
          ? ['👍', undefined, undefined, options]
          : helper === 'getReactions'
            ? [2, '👍', '', options]
            : [destination, options];
      await assert.rejects(
        message[helper](...args),
        (error) => error === reason
      );
      assert.equal(calls.length, 1);
    });
  }
  it(`leaves ${style} uncorrelated copy results undefined`, async () => {
    const { message, calls } = await ownedMessage(style);
    assert.equal(await message.copy(destination), undefined);
    assert.equal(calls.length, 1);
  });
  it(`preserves the ${style} official paid-reaction rejection without a paid transfer`, async () => {
    const { message, calls } = await ownedMessage(style, messagePage(), () => {
      throw Object.assign(new Error('REACTION_INVALID'), { code: 400 });
    });
    await assert.rejects(message.react(new Api.ReactionPaid()), {
      type: 'REACTION_INVALID',
      backend: 'native',
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], 'messages.sendReaction');
  });
}

it('executes reactions, page cursors and correlated copies over independent encrypted TCP', async () => {
  const calls = [];
  const peer = await secretRpcPeer((request) => {
    calls.push(request);
    return response(request);
  });
  const client = new Anygram({
    adapters: [createAdapter('native', peer.client, { kind: 'mtproto' })],
  });
  try {
    const [message] = await client.gramjs.getMessages(
      new Api.InputPeerUser({ userId: 9n, accessHash: 17n })
    );
    await message.react(['👍', 9007199254740993n], true, true);
    const page = await message.getReactions(2, '👍', 'page');
    assert.equal(page.nextOffset, 'cursor');
    const copy = await message.copy(destination, { schedule: 123 });
    assert.equal(copy.id, 11);
    assert.equal(copy.chatId, -10031n);
    assert.equal(calls.length, 4);
    assert.equal(calls[1].reaction[1].document_id, 9007199254740993n);
    assert.equal(calls[2].offset, 'page');
    assert.equal(calls[3].drop_author, true);
    assert.equal(calls[3].schedule_date, 123);
  } finally {
    await client.disconnect();
    await peer.close();
  }
});
