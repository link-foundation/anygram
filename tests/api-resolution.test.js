import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api, Anygram, createAdapter } from '../src/index.js';
import { TelegramClient as GramClient } from 'telegram';
import { TelegramClient as TeleClient } from 'teleproto';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import * as GramUtils from 'telegram/Utils.js';
import * as TeleUtils from 'teleproto/Utils.js';
import { TlCodec } from '../src/tl.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const user = { _: 'inputPeerUser', user_id: 7n, access_hash: -17n };
const channel = { _: 'inputPeerChannel', channel_id: 9n, access_hash: 27n };
const codec = new TlCodec();

function fixture() {
  const resolved = [];
  const context = {
    async getInputEntity(peer) {
      resolved.push(peer);
      if (peer === 'me') {
        return { _: 'inputPeerSelf' };
      }
      return peer === '@channel' ? channel : user;
    },
  };
  return { context, resolved };
}

for (const [label, Vendor, utils, Client] of [
  ['gramjs', GramApi, GramUtils, GramClient],
  ['teleproto', TeleApi, TeleUtils, TeleClient],
]) {
  it(`resolves native peer shortcuts to the same argument bytes as actual ${label} classes`, async () => {
    const cases = [
      [
        'messages',
        'SendMessage',
        { peer: '@alice', message: 'hi', randomId: 1n, sendAs: 'me' },
      ],
      ['users', 'GetUsers', { id: ['@alice', 'me'] }],
      ['channels', 'GetChannels', { id: ['@channel'] }],
      ['messages', 'GetPeerDialogs', { peers: ['@alice'] }],
      ['account', 'GetNotifySettings', { peer: '@alice' }],
      ['messages', 'GetMessages', { id: [7, 9] }],
    ];
    for (const [scope, method, args] of cases) {
      const native = new Api[scope][method](args);
      assert.equal(typeof native.resolve, 'function');
      const { context, resolved } = fixture();
      await native.resolve(context);
      const vendorArgs =
        method === 'GetPeerDialogs'
          ? {
              peers: [
                new Vendor.InputPeerUser({ userId: 7n, accessHash: -17n }),
              ],
            }
          : args;
      const vendor = new Vendor[scope][method](vendorArgs);
      await vendor.resolve(
        Object.assign(Object.create(Client.prototype), {
          async getInputEntity(peer) {
            if (peer === 'me') {
              return new Vendor.InputPeerSelf();
            }
            return peer === '@channel'
              ? new Vendor.InputPeerChannel({ channelId: 9n, accessHash: 27n })
              : new Vendor.InputPeerUser({ userId: 7n, accessHash: -17n });
          },
        }),
        utils
      );
      assert.deepEqual(
        native.getBytes().subarray(4),
        vendor.getBytes().subarray(4),
        `${scope}.${method}`
      );
      const before = resolved.length;
      await native.resolve(context);
      assert.equal(
        resolved.length,
        before,
        'Fully specified inputs require no lookup'
      );
    }
  });
}

it('resolves owned native requests through the selected adapter and reuses its peer cache', async () => {
  const calls = [];
  const client = new Anygram({
    adapters: [
      createAdapter(
        'native',
        {
          async call(method, params) {
            calls.push(method);
            if (method === 'contacts.resolveUsername') {
              return {
                _: 'contacts.resolvedPeer',
                peer: { _: 'peerUser', user_id: 7n },
                users: [
                  { _: 'user', id: 7n, access_hash: -17n, username: 'alice' },
                ],
                chats: [],
              };
            }
            assert.equal(method, 'messages.sendMessage');
            assert.deepEqual(params.peer, user);
            return { _: 'updatesTooLong' };
          },
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  const request = new Api.messages.SendMessage({
    peer: '@alice',
    message: 'hello',
    randomId: 5n,
  });
  await client.invoke(request);
  await client.invoke(
    new Api.messages.SendMessage({ peer: '@alice', message: 'again' })
  );
  assert.deepEqual(calls, [
    'contacts.resolveUsername',
    'messages.sendMessage',
    'messages.sendMessage',
  ]);
  assert.equal(request.peer.className, 'InputPeerUser');
  assert.equal(codec.decode(request.getBytes()).random_id, 5n);
});

it('rejects peer type mismatches before sending and preserves supplied special constructors', async () => {
  const { context, resolved } = fixture();
  const wrong = new Api.users.GetUsers({ id: ['@channel'] });
  assert.equal(typeof wrong.resolve, 'function');
  await assert.rejects(wrong.resolve(context), /InputUser/i);
  const notify = new Api.account.GetNotifySettings({
    peer: new Api.InputNotifyUsers(),
  });
  const special = notify.peer;
  await notify.resolve(context);
  assert.equal(notify.peer, special);
  assert.deepEqual(resolved, ['@channel']);
  await assert.rejects(new Api.InputPeerSelf().resolve(context), /request/i);
});

it('honors cancellation before lookup and after awaited resolution without sending', async () => {
  const controller = new globalThis.AbortController();
  const reason = new Error('stop lookup');
  const calls = [];
  const client = new Anygram({
    adapters: [
      createAdapter(
        'native',
        {
          async call(method) {
            calls.push(method);
            controller.abort(reason);
            return {
              _: 'contacts.resolvedPeer',
              peer: { _: 'peerUser', user_id: 7n },
              users: [{ _: 'user', id: 7n, access_hash: -17n }],
              chats: [],
            };
          },
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  const request = new Api.messages.SendMessage({
    peer: '@alice',
    message: 'hello',
  });
  await assert.rejects(
    client.invoke(request, { signal: controller.signal }),
    /stop lookup/
  );
  assert.deepEqual(calls, ['contacts.resolveUsername']);
  await assert.rejects(
    client.invoke(request, { signal: controller.signal }),
    /stop lookup/
  );
  assert.deepEqual(calls, ['contacts.resolveUsername']);
});

it('resolves usernames before sending owned native classes over encrypted TCP', async () => {
  const calls = [];
  const peer = await secretRpcPeer((request) => {
    calls.push(request._);
    if (request._ === 'contacts.resolveUsername') {
      assert.equal(request.username, 'alice');
      return {
        _: 'contacts.resolvedPeer',
        peer: { _: 'peerUser', user_id: 7n },
        users: [{ _: 'user', id: 7n, access_hash: -17n, username: 'alice' }],
        chats: [],
      };
    }
    assert.equal(request._, 'messages.sendMessage');
    assert.deepEqual(request.peer, user);
    assert.equal(request.message, 'encrypted');
    return { _: 'updatesTooLong' };
  });
  const client = new Anygram({
    adapters: [createAdapter('native', peer.client, { kind: 'mtproto' })],
  });
  try {
    await client.invoke(
      new Api.messages.SendMessage({ peer: '@alice', message: 'encrypted' })
    );
    assert.deepEqual(calls, [
      'contacts.resolveUsername',
      'messages.sendMessage',
    ]);
  } finally {
    await client.disconnect();
    await peer.close();
  }
});

it('resolves nested dialog/notification peers and message objects without unnecessary lookups', async () => {
  const { context, resolved } = fixture();
  const dialog = new Api.InputDialogPeer({ peer: '@alice' });
  const request = new Api.messages.GetPeerDialogs({ peers: [dialog] });
  await request.resolve(context);
  assert.equal(request.peers[0], dialog);
  assert.equal(dialog.peer.className, 'InputPeerUser');
  const notify = new Api.InputNotifyPeer({ peer: 'me' });
  await new Api.account.GetNotifySettings({ peer: notify }).resolve(context);
  assert.equal(notify.peer.className, 'InputPeerSelf');
  const message = new Api.Message({ id: 29 });
  const history = new Api.messages.GetMessages({ id: [message] });
  await history.resolve(context);
  assert.deepEqual(codec.decode(history.getBytes()).id, [
    { _: 'inputMessageID', id: 29 },
  ]);
  assert.deepEqual(resolved, ['@alice', 'me']);
});

it('validates resolver vectors and pre-aborted empty requests without lookups', async () => {
  const { context, resolved } = fixture();
  await assert.rejects(
    new Api.users.GetUsers({ id: 'bad vector' }).resolve(context),
    /vector length/i
  );
  const controller = new globalThis.AbortController();
  controller.abort(new Error('already stopped'));
  await assert.rejects(
    new Api.help.GetConfig().resolve(context, { signal: controller.signal }),
    /already stopped/
  );
  assert.deepEqual(resolved, []);
});

it('resolves peers inside generic queries, story media and optional reply objects', async () => {
  const { context, resolved } = fixture();
  const request = new Api.InvokeWithoutUpdates({
    query: new Api.messages.SendMedia({
      peer: 'me',
      media: new Api.InputMediaStory({ peer: '@alice', id: 7 }),
      replyTo: new Api.InputReplyToMessage({
        replyToMsgId: 3,
        replyToPeerId: '@channel',
      }),
      message: 'story',
    }),
  });
  await request.resolve(context);
  const decoded = codec.decode(request.getBytes()).query;
  assert.deepEqual(decoded.peer, { _: 'inputPeerSelf' });
  assert.deepEqual(decoded.media.peer, user);
  assert.deepEqual(decoded.reply_to.reply_to_peer_id, channel);
  assert.deepEqual(resolved, ['me', '@channel', '@alice']);
});

it('resolves nested message-origin peers and canonical fields without losing object identity', async () => {
  const { context, resolved } = fixture();
  const input = new Api.InputUserFromMessage({
    peer: '@channel',
    msgId: 3,
    userId: 7n,
  });
  const request = new Api.users.GetUsers({ id: [input] });
  await request.resolve(context);
  assert.equal(request.id[0], input);
  assert.equal(input.peer.className, 'InputPeerChannel');
  const media = { _: 'inputMediaStory', peer: '@alice', id: 7 };
  const send = new Api.messages.SendMedia({
    peer: 'me',
    media,
    message: 'story',
  });
  await send.resolve(context);
  assert.equal(send.media, media);
  assert.deepEqual(codec.decode(send.getBytes()).media.peer, user);
  assert.deepEqual(resolved, ['@channel', 'me', '@alice']);
});

it('retains depth guards when an awaited resolver mutates a later request field', async () => {
  const request = new Api.messages.SendMessage({
    peer: '@alice',
    message: 'hello',
  });
  let reads = 0;
  const rich = { _: 'textBold' };
  Object.defineProperty(rich, 'text', {
    enumerable: true,
    get() {
      if (++reads > 72) {
        throw new Error('Probe exceeded bounded late traversal');
      }
      return rich;
    },
  });
  await assert.rejects(
    request.resolve({
      async getInputEntity() {
        request.replyTo = new Api.InputReplyToMessage({
          replyToMsgId: 1,
          quoteRich: [rich],
        });
        return user;
      },
    }),
    /depth limit/i
  );
});

for (const [kind, Vendor] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
  ['mtcute', undefined],
  ['mtproto', undefined],
  ['native', undefined],
]) {
  it(`routes native username resolution through the selected ${kind} backend`, async () => {
    const calls = [];
    const send = (method, params) => {
      calls.push(method);
      if (method === 'contacts.resolveUsername') {
        const result = {
          _: 'contacts.resolvedPeer',
          peer: { _: 'peerUser', user_id: 7n },
          users: [{ _: 'user', id: 7n, access_hash: -17n, username: 'alice' }],
          chats: [],
        };
        return Vendor
          ? new Vendor.contacts.ResolvedPeer({
              peer: new Vendor.PeerUser({ userId: 7n }),
              users: [
                new Vendor.User({
                  id: 7n,
                  accessHash: -17n,
                  username: 'alice',
                }),
              ],
              chats: [],
            })
          : result;
      }
      assert.equal(method, 'messages.sendMessage');
      const input = params.peer;
      assert.equal(String(input.user_id ?? input.userId), '7');
      assert.equal(String(input.access_hash ?? input.accessHash), '-17');
      return { _: 'updatesTooLong' };
    };
    const backend = Vendor
      ? {
          async invoke(request) {
            const method =
              request.className === 'contacts.ResolveUsername'
                ? 'contacts.resolveUsername'
                : 'messages.sendMessage';
            assert(
              request instanceof
                (method === 'contacts.resolveUsername'
                  ? Vendor.contacts.ResolveUsername
                  : Vendor.messages.SendMessage)
            );
            assert(request.getBytes().length > 4);
            return send(method, request);
          },
        }
      : {
          async call(method, params) {
            return kind === 'mtcute'
              ? send(method._, method)
              : send(method, params);
          },
        };
    const client = new Anygram({
      backend: kind,
      adapters: [
        createAdapter(kind, backend, {
          Api: Vendor,
          kind: kind === 'native' ? 'mtproto' : kind,
        }),
        createAdapter(
          'unused',
          { call: () => assert.fail('Another backend was selected') },
          { kind: 'mtproto' }
        ),
      ],
    });
    await client.invoke(
      new Api.messages.SendMessage({ peer: '@alice', message: 'hello' })
    );
    assert.deepEqual(calls, [
      'contacts.resolveUsername',
      'messages.sendMessage',
    ]);
  });
}

it('preserves lookup failures without invoking the send or replaying another backend', async () => {
  const calls = [];
  const client = new Anygram({
    adapters: [
      createAdapter(
        'first',
        {
          call(method) {
            calls.push(method);
            throw new Error('FLOOD_WAIT_7');
          },
        },
        { kind: 'mtproto' }
      ),
      createAdapter(
        'second',
        {
          call: () => assert.fail('Lookup was replayed'),
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  await assert.rejects(
    client.invoke(
      new Api.messages.SendMessage({ peer: '@alice', message: 'hello' })
    ),
    (error) => error.retryAfter === 7
  );
  assert.deepEqual(calls, ['contacts.resolveUsername']);
});
