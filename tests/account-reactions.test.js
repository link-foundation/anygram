import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as Vendor } from 'teleproto/tl/index.js';
import * as methods from 'teleproto/client/methods/messages.js';
import { returnBigInt } from 'teleproto/Helpers.js';
import { TlCodec } from '../src/tl.js';
import { Anygram, Api, createAdapter } from '../src/index.js';
import {
  messagePage,
  ownedMessage,
  sdkMessage,
  canonical,
} from './fixtures/account-message-models.js';

const codec = new TlCodec();
const reactionCases = [
  ['omitted', () => undefined],
  ['null', () => null],
  ['empty vector', () => []],
  ['emoji', () => '👍'],
  ['numeric text emoji', () => '42'],
  ['exact bigint', () => 9007199254740993n],
  ['SDK legacy integer', () => returnBigInt('9007199254740993')],
  ['safe number', () => 42],
  ['emoji constructor', () => new Vendor.ReactionEmoji({ emoticon: '🔥' })],
  [
    'custom constructor',
    () => new Vendor.ReactionCustomEmoji({ documentId: 9007199254740993n }),
  ],
  ['paid constructor', () => new Vendor.ReactionPaid()],
  ['empty constructor', () => new Vendor.ReactionEmpty()],
  ['mixed vector', () => ['👍', 9007199254740993n, new Vendor.ReactionEmpty()]],
];
const list = () => ({
  _: 'messages.messageReactionsList',
  count: 0,
  reactions: [],
  chats: [],
  users: [{ _: 'user', id: 21n, access_hash: 23n, first_name: 'Reactor' }],
  next_offset: 'cursor',
});

function actualMessage() {
  const { message } = sdkMessage(Vendor);
  const requests = [];
  const client = message.client;
  client.invoke = async (request) => {
    requests.push(request);
    return new Vendor.UpdatesTooLong();
  };
  client.sendReaction = (...args) => methods.sendReaction(client, ...args);
  client.getReactionUsers = (...args) =>
    methods.getReactionUsers(client, ...args);
  return { message, requests };
}

for (const style of ['gramjs', 'teleproto']) {
  for (const [name, create] of reactionCases) {
    it(`compares actual teleproto react ${name} request bytes through ${style}`, async () => {
      const actual = actualMessage();
      await actual.message.react(create(), true, false);
      const input = create();
      const snapshot = canonical(input);
      const { message, calls } = await ownedMessage(style);
      const result = await message.react(input, true, false);
      assert.equal(result._, 'updatesTooLong');
      assert.equal(calls.length, 1);
      assert.equal(actual.requests.length, 1);
      assert.deepEqual(
        codec.encode({ _: calls[0][0], ...calls[0][1] }),
        new Uint8Array(actual.requests[0].getBytes())
      );
      assert.deepEqual(canonical(input), snapshot);
      assert.equal(calls[0][1].peer.access_hash, 17n);
    });
  }
  for (const args of [
    [],
    [0, '👍', ''],
    [
      2,
      new Vendor.ReactionCustomEmoji({ documentId: 9007199254740993n }),
      'page',
    ],
    [3, new Vendor.ReactionEmpty(), 'last'],
  ]) {
    it(`compares actual teleproto reaction list ${JSON.stringify(args, (_, v) => (typeof v === 'bigint' ? String(v) : v))} through ${style}`, async () => {
      const actual = actualMessage();
      await actual.message.getReactions(...args);
      const response = list();
      const { message, calls } = await ownedMessage(
        style,
        messagePage(),
        () => response
      );
      const result = await message.getReactions(...args);
      assert.equal(result.count, 0);
      assert.equal(result.nextOffset, 'cursor');
      assert.equal(result.users[0].id, 21n);
      result.users[0].firstName = 'Detached';
      assert.equal(response.users[0].first_name, 'Reactor');
      assert.equal(calls.length, 1);
      assert.deepEqual(
        codec.encode({ _: calls[0][0], ...calls[0][1] }),
        new Uint8Array(actual.requests[0].getBytes())
      );
    });
  }
  for (const options of [
    undefined,
    { silent: true, schedule: 123 },
    { silent: true, schedule: new Date(123456) },
    { dropAuthor: false, messages: [99], fromPeer: 'wrong' },
  ]) {
    it(`copies ${style} messages without an author through the actual teleproto helper contract`, async () => {
      const actual = actualMessage();
      const destination = new Vendor.InputPeerChannel({
        channelId: 31n,
        accessHash: 33n,
      });
      const forwarded = [];
      actual.message.client.forwardMessages = async (...args) => {
        forwarded.push(args);
        return [actual.message];
      };
      assert.equal(
        await actual.message.copy(destination, options),
        actual.message
      );
      const { message, calls } = await ownedMessage(
        style,
        messagePage(),
        (_method, params) => ({
          _: 'updates',
          updates: [
            { _: 'updateMessageID', id: 11, random_id: params.random_id[0] },
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
          users: [],
          chats: [],
          date: 1,
          seq: 1,
        })
      );
      const copied = await message.copy(destination, options);
      assert.equal(copied.id, 11);
      assert.equal(copied.client, message.client);
      assert.equal(copied.inputChat.accessHash, 33n);
      assert.equal(copied.chatId, -10031n);
      assert.equal(calls.length, 1);
      const params = calls[0][1];
      assert.equal(params.drop_author, forwarded[0][1].dropAuthor);
      assert.deepEqual(params.id, forwarded[0][1].messages);
      assert.equal(params.from_peer.access_hash, 17n);
      assert.equal(params.to_peer.access_hash, 33n);
      const expectedArgs = {
        ...options,
        scheduleDate: options?.schedule,
        dropAuthor: true,
        fromPeer: forwarded[0][1].fromPeer,
        toPeer: destination,
        id: [7],
        randomId: params.random_id,
      };
      const expected = new Vendor.messages.ForwardMessages(expectedArgs);
      if (options?.schedule instanceof Date) {
        // The SDK's schema marks this field as int and writes Date milliseconds.
        assert.equal(codec.decode(expected.getBytes()).schedule_date, 123456);
        expected.scheduleDate = Math.floor(options.schedule.getTime() / 1000);
        assert.equal(params.schedule_date, 123);
      }
      assert.deepEqual(
        codec.encode({ _: calls[0][0], ...params }),
        new Uint8Array(expected.getBytes())
      );
    });
  }
  for (const helper of ['react', 'getReactions', 'copy']) {
    it(`rejects a pre-aborted ${style} ${helper} without a request`, async () => {
      const { message, calls } = await ownedMessage(style);
      const controller = new globalThis.AbortController();
      const reason = new Error('cancel reaction');
      controller.abort(reason);
      const options = { signal: controller.signal };
      const args =
        helper === 'react'
          ? ['👍', undefined, undefined, options]
          : helper === 'getReactions'
            ? [undefined, undefined, undefined, options]
            : [{ _: 'inputPeerSelf' }, options];
      await assert.rejects(
        message[helper](...args),
        (error) => error === reason
      );
      assert.equal(calls.length, 0);
    });
    it(`preserves ${style} ${helper} failures without replay`, async () => {
      const { message, calls } = await ownedMessage(
        style,
        messagePage(),
        () => {
          throw Object.assign(new Error('CHAT_WRITE_FORBIDDEN'), { code: 403 });
        }
      );
      const args =
        helper === 'react'
          ? ['👍']
          : helper === 'copy'
            ? [{ _: 'inputPeerSelf' }]
            : [];
      await assert.rejects(
        message[helper](...args),
        (error) =>
          error.type === 'CHAT_WRITE_FORBIDDEN' && error.backend === 'native'
      );
      assert.equal(calls.length, 1);
    });
  }
  for (const invalid of [
    true,
    NaN,
    1.5,
    Number.MAX_SAFE_INTEGER + 1,
    { _: 'user', id: 1n },
  ]) {
    it(`rejects invalid ${style} reaction ${String(invalid)} before transport`, async () => {
      const { message, calls } = await ownedMessage(style);
      await assert.rejects(message.react(invalid), /reaction|integer/i);
      assert.equal(calls.length, 0);
    });
  }
}

for (const surface of ['client', 'gramjs', 'teleproto']) {
  for (const helper of ['sendReaction', 'getReactionUsers']) {
    it(`resolves canonical ${surface} ${helper} peers and defaults over raw transport`, async () => {
      const calls = [];
      const client = new Anygram({
        adapters: [
          createAdapter(
            'native',
            {
              call: async (method, params) => {
                calls.push([method, params]);
                return helper === 'sendReaction'
                  ? { _: 'updatesTooLong' }
                  : list();
              },
            },
            { kind: 'mtproto' }
          ),
        ],
      });
      const target = surface === 'client' ? client : client[surface];
      const peer = new Api.InputPeerUser({ userId: 9n, accessHash: 17n });
      const result = await target[helper](peer, 7);
      assert.equal(calls.length, 1);
      assert.equal(calls[0][1].peer.access_hash, 17n);
      if (helper === 'sendReaction') {
        assert.deepEqual(calls[0][1].reaction, []);
      } else {
        assert.equal(calls[0][1].limit, 100);
        assert.equal(calls[0][1].offset, '');
        assert.equal(
          surface === 'client' ? result.next_offset : result.nextOffset,
          'cursor'
        );
      }
    });
  }
}
