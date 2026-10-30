import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { MarkdownParser as GramMarkdown } from 'telegram/extensions/markdown.js';
import { HTMLParser as TeleHtml } from 'teleproto/extensions/html.js';
import * as gramMethods from 'telegram/client/messages.js';
import * as teleMethods from 'teleproto/client/methods/messages.js';
import { Anygram, createAdapter, createClient } from '../src/index.js';
import { objectRequest, requestOf, gramRequest } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import {
  messagePage,
  ownedMessage,
  sdkMessage,
} from './fixtures/account-message-models.js';

const peer = { _: 'inputPeerUser', user_id: 9n, access_hash: 17n };
const mode = {
  parse: () => ['🚀 Ada', [{ _: 'messageEntityBold', offset: 3, length: 3 }]],
  unparse: (text) => text,
};
const codec = new TlCodec();

for (const [name, Vendor, methods, parseMode, source] of [
  ['GramJS', GramApi, gramMethods, GramMarkdown, '🚀 **Ada**'],
  ['teleproto', TeleApi, teleMethods, TeleHtml, '🚀 <b>Ada</b>'],
]) {
  for (const facade of ['canonical', 'gramjs', 'teleproto']) {
    for (const action of ['send', 'edit']) {
      it(`compares ${facade} parsed ${action} bytes with actual ${name}`, async () => {
        const sdk = sdkMessage(Vendor).message.client;
        const requests = [];
        sdk.buildReplyMarkup = () => undefined;
        sdk._getResponseMessage = () => undefined;
        sdk.invoke = async (request) => {
          requests.push(request);
          return new Vendor.UpdatesTooLong();
        };
        const target = gramRequest(Vendor, requestOf(peer));
        await methods[action === 'send' ? 'sendMessage' : 'editMessage'](
          sdk,
          target,
          {
            message: action === 'send' ? source : 7,
            text: action === 'edit' ? source : undefined,
            parseMode,
          }
        );
        const { client, message, calls } = await ownedMessage(
          facade === 'canonical' ? 'teleproto' : facade
        );
        client.setParseMode(parseMode);
        if (action === 'send') {
          await (facade === 'canonical' ? client : client[facade]).sendMessage(
            peer,
            { message: source }
          );
          requests[0].randomId = calls[0][1].random_id;
        } else if (facade === 'canonical') {
          await client.editMessage(peer, { id: 7, text: source });
        } else {
          await message.edit({ text: source, linkPreview: true });
        }
        const request = { _: calls[0][0], ...calls[0][1] };
        const expected = new Uint8Array(requests[0].getBytes());
        assert.deepEqual(
          new Uint8Array(gramRequest(Vendor, requestOf(request)).getBytes()),
          expected
        );
        const current = codec.encode(request);
        if (name === 'GramJS') {
          // The pinned SDK uses older method IDs; all following fields match.
          assert.notDeepEqual(current.subarray(0, 4), expected.subarray(0, 4));
          assert.deepEqual(current.subarray(4), expected.subarray(4));
        } else {
          assert.deepEqual(current, expected);
        }
      });
    }
  }
}

for (const backend of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
  it(`parses once through only the selected ${backend} raw transport`, async () => {
    const calls = [];
    let parsed = 0;
    const execute = (request) => {
      calls.push(objectRequest(requestOf(request)));
      return { _: 'updatesTooLong' };
    };
    const client = new Anygram({
      backend,
      parseMode: {
        ...mode,
        parse: () => {
          parsed++;
          return mode.parse();
        },
      },
      adapters: [
        createAdapter(
          'unused',
          { call: () => assert.fail('unselected backend') },
          { kind: 'mtproto' }
        ),
        createAdapter(
          backend,
          {
            sendMessage: () =>
              assert.fail('vendor helper bypassed shared parser'),
            editMessage: () =>
              assert.fail('vendor helper bypassed shared parser'),
            invoke: async (request) => {
              assert.equal(typeof request.getBytes, 'function');
              return execute(request);
            },
            call: async (method, params) =>
              execute(
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
    await client.sendMessage(peer, '*Ada*');
    await client.editMessage(peer, { id: 7, text: '*Ada*' });
    assert.equal(parsed, 2);
    assert.equal(calls.length, 2);
    assert.deepEqual(
      calls.map((call) => call.message),
      ['🚀 Ada', '🚀 Ada']
    );
    assert.deepEqual(
      calls.map((call) => call.entities[0].offset),
      [3, 3]
    );
  });
}

it('carries custom parse modes through the disconnected native factory', async () => {
  const client = await createClient({
    apiId: 12345,
    apiHash: 'example',
    libraries: [],
    parseMode: mode,
    transport: {
      request: async () => assert.fail('factory connected eagerly'),
    },
  });
  assert.equal(client.parseMode, mode);
  assert.equal(client.gramjs.parseMode, mode);
  assert.equal(client.teleproto.parseMode, mode);
});

it('keeps selected mention-resolution failures without sending or replay', async () => {
  const calls = [];
  const client = new Anygram({
    backend: 'selected',
    adapters: [
      createAdapter(
        'unused',
        { call: () => assert.fail('failure replayed') },
        { kind: 'mtproto' }
      ),
      createAdapter(
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
    client.sendMessage(peer, 'Ada', {
      parseMode: {
        parse: () => [
          'Ada',
          [
            {
              _: 'messageEntityTextUrl',
              offset: 0,
              length: 3,
              url: '@missing',
            },
          ],
        ],
        unparse: () => '',
      },
    }),
    { type: 'USERNAME_NOT_OCCUPIED', code: 400, backend: 'selected' }
  );
  assert.deepEqual(calls, ['contacts.resolveUsername']);
});

it('keeps account parser defaults out of Bot API calls', async () => {
  const calls = [];
  const client = new Anygram({
    parseMode: mode,
    adapters: [
      createAdapter(
        'bot',
        {
          callApi: async (method, params) => {
            calls.push([method, params]);
            return {};
          },
        },
        { kind: 'grammy' }
      ),
    ],
  });
  await client.sendMessage(9, '*literal*', { parse_mode: 'MarkdownV2' });
  assert.deepEqual(calls, [
    [
      'sendMessage',
      { chat_id: 9, text: '*literal*', parse_mode: 'MarkdownV2' },
    ],
  ]);
});

it('parses replies and edits over independent encrypted native TCP', async () => {
  const calls = [];
  const remote = await secretRpcPeer((request) => {
    calls.push(request);
    return request._ === 'messages.getHistory'
      ? messagePage()
      : { _: 'updatesTooLong' };
  });
  const client = new Anygram({
    parseMode: mode,
    adapters: [createAdapter('native', remote.client, { kind: 'mtproto' })],
  });
  try {
    const [message] = await client.teleproto.getMessages(peer);
    await client.sendMessage(peer, '*Ada*');
    await message.reply({ message: '*Ada*' });
    await message.edit({ text: '*Ada*' });
    assert.equal(calls.length, 4);
    assert.deepEqual(
      calls.slice(1).map((call) => call.message),
      ['🚀 Ada', '🚀 Ada', '🚀 Ada']
    );
    assert.deepEqual(
      calls.slice(1).map((call) => call.entities),
      Array.from({ length: 3 }, () => mode.parse()[1])
    );
    assert.deepEqual(
      calls.map((call) => call.peer.access_hash),
      [17n, 17n, 17n, 17n]
    );
    assert.equal(calls[2].reply_to.reply_to_msg_id, 7);
    assert.equal(calls[3].id, 7);
  } finally {
    await client.disconnect();
    await remote.close();
  }
});
