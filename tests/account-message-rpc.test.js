import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import * as gramMethods from 'telegram/client/messages.js';
import * as teleMethods from 'teleproto/client/methods/messages.js';
import { TlCodec } from '../src/tl.js';
import { Anygram, createAdapter } from '../src/index.js';
import {
  messagePage,
  ownedMessage,
  sdkMessage,
} from './fixtures/account-message-models.js';

const codec = new TlCodec();
for (const [style, Vendor, methods] of [
  ['gramjs', GramApi, gramMethods],
  ['teleproto', TeleApi, teleMethods],
]) {
  for (const missing of [true, false]) {
    it(`retains the explicit ${style} request peer over ${missing ? 'missing' : 'conflicting'} response entities`, async () => {
      const page = messagePage();
      page.users = missing ? [] : [{ ...page.users[0], access_hash: 999n }];
      const vendor = sdkMessage(Vendor, page).message;
      vendor._finishInit(
        vendor.client,
        new Map(),
        new Vendor.InputPeerUser({ userId: 9n, accessHash: 17n })
      );
      const { message, calls } = await ownedMessage(style, page);
      assert.equal(message.inputChat.accessHash, 17n);
      assert.equal(
        message.inputChat.accessHash,
        BigInt((await vendor.getInputChat()).accessHash.toString())
      );
      await message.reply({ message: 'Known origin' });
      assert.equal(calls.length, 1);
      assert.equal(calls[0][0], 'messages.sendMessage');
      assert.equal(calls[0][1].peer.access_hash, 17n);
    });
  }
  for (const action of ['pin', 'unpin', 'markAsRead']) {
    it(`matches actual ${style} client RPC bytes for message ${action}`, async () => {
      const requests = [];
      const vendorClient = {
        getInputEntity: async (value) => value,
        invoke: async (request) => {
          requests.push(request);
          return { updates: [] };
        },
        _getResponseMessage: () => undefined,
      };
      vendorClient.api = {
        messages: {
          readHistory: (params) =>
            vendorClient.invoke(new Vendor.messages.ReadHistory(params)),
        },
      };
      const peer = new Vendor.InputPeerUser({ userId: 9n, accessHash: 17n });
      const params = { notify: true, pmOneSide: true };
      if (action === 'markAsRead') {
        await methods.markAsRead(vendorClient, peer, 7);
      } else {
        await methods[`${action}Message`](vendorClient, peer, 7, params);
      }
      const { message, calls } = await ownedMessage(style);
      await message[action](params);
      assert.equal(requests.length, 1);
      assert.equal(calls.length, 1);
      assert.deepEqual(
        codec.encode({ _: calls[0][0], ...calls[0][1] }),
        new Uint8Array(requests[0].getBytes())
      );
    });
  }
  it(`uses the same reply lookup and cache sequence as actual ${style} message models`, async () => {
    const vendor = sdkMessage(Vendor);
    const requests = [];
    vendor.message.client.getMessages = async (_peer, options) => {
      requests.push(options.ids);
      return requests.length === 1 ? [] : [vendor.message];
    };
    assert.equal(await vendor.message.getReplyMessage(), vendor.message);
    assert.equal(await vendor.message.getReplyMessage(), vendor.message);
    const { message, calls } = await ownedMessage(
      style,
      messagePage(),
      (_method, params) => ({
        ...messagePage(),
        messages:
          params.id[0]._ === 'inputMessageReplyTo'
            ? []
            : messagePage().messages,
      })
    );
    await message.getReplyMessage();
    await message.getReplyMessage();
    assert.equal(calls.length, requests.length);
    assert.equal(requests[0].className, 'InputMessageReplyTo');
    assert.equal(requests[0].id, calls[0][1].id[0].id);
    assert.equal(requests[1], calls[1][1].id[0].id);
  });
}

it('preserves missing-message positions while skipping them during history iteration', async () => {
  const page = messagePage();
  page.messages = [{ _: 'messageEmpty', id: 3 }, page.messages[0]];
  const { client } = await ownedMessage('gramjs', page, () => page);
  const messages = await client.gramjs.getMessages(
    { _: 'inputPeerUser', user_id: 9n, access_hash: 17n },
    { ids: [3, 7] }
  );
  assert.equal(messages[0], undefined);
  assert.equal(messages[1].id, 7);
  const streamed = [];
  for await (const message of client.gramjs.iterMessages(
    { _: 'inputPeerUser', user_id: 9n, access_hash: 17n },
    { limit: 2 }
  )) {
    streamed.push(message);
  }
  assert.deepEqual(
    streamed.map((message) => message.id),
    [7]
  );
});

it('does not resolve an unused peer when history requests zero messages', async () => {
  const { client, calls } = await ownedMessage('gramjs');
  const messages = [];
  for await (const message of client.gramjs.iterMessages('unused', {
    limit: 0,
  })) {
    messages.push(message);
  }
  assert.deepEqual(messages, []);
  assert.equal(calls.length, 0);
});

it('resolves a missing channel hash with one bounded dialog page and retains cached entities', async () => {
  const page = messagePage();
  page.messages[0].peer_id = { _: 'peerChannel', channel_id: 19n };
  const methods = [];
  const client = new Anygram({
    adapters: [
      createAdapter(
        'native',
        {
          call: async (method, params) => {
            methods.push(method);
            if (method === 'messages.getHistory') {
              return page;
            }
            assert.equal(method, 'messages.getDialogs');
            assert.equal(params.limit, 100);
            return {
              _: 'messages.dialogs',
              dialogs: [
                {
                  _: 'dialog',
                  peer: { _: 'peerChannel', channel_id: 19n },
                  top_message: 7,
                  unread_count: 0,
                  unread_mentions_count: 0,
                  unread_reactions_count: 0,
                  read_inbox_max_id: 0,
                  read_outbox_max_id: 0,
                  notify_settings: { _: 'peerNotifySettings' },
                },
              ],
              messages: page.messages,
              users: [],
              chats: [
                {
                  _: 'channel',
                  id: 19n,
                  access_hash: 23n,
                  title: 'Group',
                  megagroup: true,
                  date: 1,
                  photo: { _: 'chatPhotoEmpty' },
                },
              ],
            };
          },
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  const [message] = await client.gramjs.getMessages({ _: 'inputPeerSelf' });
  assert.equal(message.inputChat, undefined);
  assert.equal((await message.getInputChat()).accessHash, 23n);
  assert.equal((await message.getInputChat()).channelId, 19n);
  assert.equal((await message.getChat()).title, 'Group');
  assert.equal(message.chat, message.chat);
  assert.deepEqual(methods, ['messages.getHistory', 'messages.getDialogs']);
});

for (const size of [
  { _: 'photoSize', type: 'x', w: 10, h: 20, size: 31 },
  { _: 'photoSizeEmpty', type: 'x' },
  {
    _: 'photoCachedSize',
    type: 'x',
    w: 10,
    h: 20,
    bytes: new Uint8Array([1, 2]),
  },
  { _: 'photoStrippedSize', type: 'x', bytes: new Uint8Array([1, 2, 3]) },
  { _: 'photoSizeProgressive', type: 'x', w: 10, h: 20, sizes: [10, 20] },
]) {
  it(`matches the actual SDK file byte count for ${size._}`, async () => {
    const page = messagePage();
    page.messages[0].media.photo.sizes = [size];
    const vendor = sdkMessage(GramApi, page).message;
    const { message } = await ownedMessage('gramjs', page);
    assert.equal(message.file.size, vendor.file.size);
    assert.equal(message.file.mimeType, 'image/jpeg');
    assert.throws(() => message.file.id, /Unsupported/);
  });
}
