import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { HTMLParser as GramHtml } from 'telegram/extensions/html.js';
import { HTMLParser as TeleHtml } from 'teleproto/extensions/html.js';
import { MarkdownParser as GramMarkdown } from 'telegram/extensions/markdown.js';
import { MarkdownParser as TeleMarkdown } from 'teleproto/extensions/markdown.js';
import { MarkdownV2Parser as TeleV2 } from 'teleproto/extensions/markdownv2.js';
import * as gramUploads from 'telegram/client/uploads.js';
import * as teleUploads from 'teleproto/client/methods/uploads.js';
import * as gramMessages from 'telegram/client/messages.js';
import * as teleMessages from 'teleproto/client/methods/messages.js';
import { Anygram, createAdapter } from '../src/index.js';
import { requestOf, gramRequest, objectRequest } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import {
  ownedMessage,
  sdkMessage,
  messagePage,
} from './fixtures/account-message-models.js';

const peer = { _: 'inputPeerUser', user_id: 9n, access_hash: 17n };
const file = {
  _: 'inputMediaPhoto',
  id: {
    _: 'inputPhoto',
    id: 11n,
    access_hash: 13n,
    file_reference: new Uint8Array([1]),
  },
};
const codec = new TlCodec();
const modes = [
  ['html', '🚀 <b>Ada</b>'],
  ['md', '🚀 **Ada**'],
  ['md2', '🚀 *Ada*'],
];

for (const [mode, source] of modes) {
  for (const [name, Vendor, uploads, messages, parseMode] of [
    [
      'GramJS',
      GramApi,
      gramUploads,
      gramMessages,
      mode === 'html' ? GramHtml : mode === 'md' ? GramMarkdown : undefined,
    ],
    [
      'teleproto',
      TeleApi,
      teleUploads,
      teleMessages,
      mode === 'html' ? TeleHtml : mode === 'md' ? TeleMarkdown : TeleV2,
    ],
  ].filter((entry) => entry[4])) {
    for (const action of ['file', 'album', 'edit']) {
      it(`compares ${mode} ${action} caption bytes with actual ${name}`, async () => {
        const sdk = sdkMessage(Vendor).message.client;
        const requests = [];
        sdk.buildReplyMarkup = () => undefined;
        sdk._getResponseMessage = () => undefined;
        sdk.invoke = async (request) => {
          requests.push(request);
          return new Vendor.UpdatesTooLong();
        };
        const input = gramRequest(Vendor, requestOf(peer));
        const media = () => gramRequest(Vendor, requestOf(file));
        if (action === 'edit') {
          await messages.editMessage(sdk, input, {
            message: 7,
            text: source,
            file: media(),
            parseMode,
          });
        } else {
          await uploads.sendFile(sdk, input, {
            file: action === 'album' ? [media(), media()] : media(),
            caption: action === 'album' ? [source, source] : source,
            parseMode,
            replyTo: 7,
          });
        }
        const { client, calls } = await ownedMessage('teleproto');
        client.setParseMode(mode);
        if (action === 'edit') {
          await client.editMessage(peer, { id: 7, text: source, file });
        } else if (action === 'album') {
          await client.sendAlbum(peer, [file, file], {
            caption: [source, source],
            replyTo: 7,
          });
          requests[0].multiMedia.forEach((entry, index) => {
            entry.randomId = calls[0][1].multi_media[index].random_id;
          });
        } else {
          await client.sendFile(peer, { file, caption: source, replyTo: 7 });
          requests[0].randomId = calls[0][1].random_id;
        }
        assert.equal(requests.length, 1);
        const request = { _: calls[0][0], ...calls[0][1] };
        const captions = request.multi_media ?? [request];
        for (const caption of captions) {
          assert.equal(caption.message, '🚀 Ada');
          assert.deepEqual(caption.entities, [
            { _: 'messageEntityBold', offset: 3, length: 3 },
          ]);
        }
        const expected = new Uint8Array(requests[0].getBytes());
        assert.deepEqual(
          new Uint8Array(gramRequest(Vendor, requestOf(request)).getBytes()),
          expected
        );
        const actual = codec.encode(request);
        if (Vendor === GramApi) {
          // Layer 181 also changes nested media/reply IDs. Verify a current-schema
          // translation separately; do not claim the historical bytes are equal.
          const current = gramRequest(
            TeleApi,
            requestOf(objectRequest(requestOf(requests[0])))
          );
          assert.deepEqual(actual, new Uint8Array(current.getBytes()));
          assert.notDeepEqual(actual, expected);
        } else {
          assert.deepEqual(actual, expected);
        }
      });
    }
  }

  it(`sends ${mode} file, album and bound media edits through encrypted native TCP`, async () => {
    const calls = [];
    const remote = await secretRpcPeer((request) => {
      calls.push(request);
      return request._ === 'messages.getHistory'
        ? messagePage()
        : { _: 'updatesTooLong' };
    });
    let client;
    try {
      client = new Anygram({
        parseMode: mode,
        adapters: [createAdapter('native', remote.client, { kind: 'mtproto' })],
      });
      const [message] = await client.teleproto.getMessages(peer);
      await client.gramjs.sendFile(peer, { file, caption: source });
      await client.teleproto.sendAlbum(peer, [file, file], {
        caption: [source, source],
      });
      await message.reply({ file, message: source });
      await message.edit({ file, text: source });
      assert.deepEqual(
        calls.map((request) => request._),
        [
          'messages.getHistory',
          'messages.sendMedia',
          'messages.sendMultiMedia',
          'messages.sendMedia',
          'messages.editMessage',
        ]
      );
      for (const request of calls.slice(1)) {
        assert.equal(request.peer.access_hash, 17n);
        for (const caption of request.multi_media ?? [request]) {
          assert.equal(caption.message, '🚀 Ada');
          assert.deepEqual(caption.entities, [
            { _: 'messageEntityBold', offset: 3, length: 3 },
          ]);
          assert.deepEqual(codec.encode(caption.media), codec.encode(file));
        }
      }
      assert.equal(calls[3].reply_to.reply_to_msg_id, 7);
      assert.equal(calls[4].id, 7);
    } finally {
      await client?.disconnect();
      await remote.close();
    }
  });
}
