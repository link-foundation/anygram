import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { HTMLParser as GramHtml } from 'telegram/extensions/html.js';
import { HTMLParser as TeleHtml } from 'teleproto/extensions/html.js';
import * as gramMethods from 'telegram/client/messages.js';
import * as teleMethods from 'teleproto/client/methods/messages.js';
import * as Package from '../src/index.js';
import { objectRequest, requestOf, gramRequest } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import {
  messagePage,
  ownedMessage,
  sdkMessage,
} from './fixtures/account-message-models.js';

const peer = { _: 'inputPeerUser', user_id: 9n, access_hash: 17n };
const source = '🚀 <b>Ada</b> <code>x &lt; y</code>';
const text = '🚀 Ada x < y';
const entities = [
  { _: 'messageEntityBold', offset: 3, length: 3 },
  { _: 'messageEntityCode', offset: 7, length: 5 },
];
const codec = new TlCodec();

for (const [name, Vendor, methods, parseMode] of [
  ['GramJS', GramApi, gramMethods, GramHtml],
  ['teleproto', TeleApi, teleMethods, TeleHtml],
]) {
  for (const action of ['send', 'edit']) {
    it(`compares builtin HTML ${action} bytes with actual ${name}`, async () => {
      const sdk = sdkMessage(Vendor).message.client;
      const requests = [];
      sdk.buildReplyMarkup = () => undefined;
      sdk._getResponseMessage = () => undefined;
      sdk.invoke = async (request) => {
        requests.push(request);
        return new Vendor.UpdatesTooLong();
      };
      await methods[action === 'send' ? 'sendMessage' : 'editMessage'](
        sdk,
        gramRequest(Vendor, requestOf(peer)),
        {
          message: action === 'send' ? source : 7,
          text: action === 'edit' ? source : undefined,
          parseMode,
        }
      );
      const { client, calls } = await ownedMessage('teleproto');
      client.setParseMode('html');
      if (action === 'send') {
        await client.sendMessage(peer, source);
        requests[0].randomId = calls[0][1].random_id;
      } else {
        await client.editMessage(peer, { id: 7, text: source });
      }
      const request = { _: calls[0][0], ...calls[0][1] };
      assert.equal(request.message, text);
      assert.deepEqual(request.entities, entities);
      const expected = new Uint8Array(requests[0].getBytes());
      assert.deepEqual(
        new Uint8Array(gramRequest(Vendor, requestOf(request)).getBytes()),
        expected
      );
      const actual = codec.encode(request);
      if (Vendor === GramApi) {
        assert.notDeepEqual(actual.subarray(0, 4), expected.subarray(0, 4));
        assert.deepEqual(actual.subarray(4), expected.subarray(4));
      } else {
        assert.deepEqual(actual, expected);
      }
    });
  }
}

for (const backend of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
  it(`uses builtin HTML only through selected ${backend} raw transport`, async () => {
    const calls = [];
    const invoke = (request) => {
      calls.push(objectRequest(requestOf(request)));
      return { _: 'updatesTooLong' };
    };
    const client = new Package.Anygram({
      backend,
      parseMode: 'html',
      adapters: [
        Package.createAdapter(
          'unused',
          { call: () => assert.fail('unselected backend') },
          { kind: 'mtproto' }
        ),
        Package.createAdapter(
          backend,
          {
            sendMessage: () => assert.fail('vendor helper bypassed owned HTML'),
            editMessage: () => assert.fail('vendor helper bypassed owned HTML'),
            invoke: async (request) => invoke(request),
            call: async (method, params) =>
              invoke(
                typeof method === 'string' ? { _: method, ...params } : method
              ),
          },
          {
            kind: backend === 'native' ? 'mtproto' : backend,
            Api: backend === 'gramjs' ? GramApi : TeleApi,
          }
        ),
      ],
    });
    await client.sendMessage(peer, source);
    await client.editMessage(peer, { id: 7, text: source });
    assert.deepEqual(
      calls.map((value) => [value.message, value.entities]),
      [
        [text, entities],
        [text, entities],
      ]
    );
  });
}

it('sends builtin HTML over independent encrypted native TCP', async () => {
  const calls = [];
  const remote = await secretRpcPeer((request) => {
    calls.push(request);
    return request._ === 'messages.getHistory'
      ? messagePage()
      : { _: 'updatesTooLong' };
  });
  let client;
  try {
    client = new Package.Anygram({
      parseMode: 'html',
      adapters: [
        Package.createAdapter('native', remote.client, { kind: 'mtproto' }),
      ],
    });
    const [message] = await client.teleproto.getMessages(peer);
    await client.sendMessage(peer, source);
    await message.reply({ message: source });
    await message.edit({ text: source });
    assert.deepEqual(
      calls.slice(1).map((value) => [value.message, value.entities]),
      Array.from({ length: 3 }, () => [text, entities])
    );
    assert.deepEqual(
      calls.map((value) => value.peer.access_hash),
      [17n, 17n, 17n, 17n]
    );
    assert.equal(calls[2].reply_to.reply_to_msg_id, 7);
    assert.equal(calls[3].id, 7);
  } finally {
    await client?.disconnect();
    await remote.close();
  }
});

it('keeps builtin HTML cancellation and typed lookup failures before sends', async () => {
  const calls = [];
  const client = new Package.Anygram({
    backend: 'selected',
    parseMode: 'html',
    adapters: [
      Package.createAdapter(
        'unused',
        { call: () => assert.fail('failure replayed') },
        { kind: 'mtproto' }
      ),
      Package.createAdapter(
        'selected',
        {
          call: async (method) => {
            calls.push(method);
            throw Object.assign(new Error('USERNAME_NOT_OCCUPIED'), {
              code: 400,
            });
          },
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  await assert.rejects(
    client.sendMessage(peer, source, {
      signal: globalThis.AbortSignal.abort(),
    }),
    (error) =>
      error.backend === 'selected' && error.cause?.name === 'AbortError'
  );
  assert.equal(calls.length, 0);
  await assert.rejects(client.sendMessage(peer, '<a href="@missing">Ada</a>'), {
    type: 'USERNAME_NOT_OCCUPIED',
    code: 400,
    backend: 'selected',
  });
  assert.deepEqual(calls, ['contacts.resolveUsername']);
});
