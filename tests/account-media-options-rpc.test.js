import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import * as GramUploads from 'telegram/client/uploads.js';
import * as TeleUploads from 'teleproto/client/methods/uploads.js';
import { Anygram, InputFile, createAdapter } from '../src/index.js';
import { gramRequest, objectRequest, requestOf } from '../src/requests.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import { messagePage } from './fixtures/account-message-models.js';
import { documentMetadata } from '../src/file-metadata.js';
import fileTypes from '../src/schema/file-types.json' with { type: 'json' };
import * as GramUtils from 'telegram/Utils.js';
import * as TeleUtils from 'teleproto/Utils.js';

const file = {
  _: 'inputFile',
  id: 7n,
  parts: 1,
  name: 'notes.txt',
  md5_checksum: '',
};
const peer = { _: 'inputPeerUser', user_id: 9n, access_hash: 17n };

for (const [style, Vendor, uploads, utils] of [
  ['gramjs', GramApi, GramUploads, GramUtils],
  ['teleproto', TeleApi, TeleUploads, TeleUtils],
]) {
  it(`matches actual ${style} metadata for all 1173 registered extensions`, () => {
    assert.equal(Object.keys(fileTypes).length, 1173);
    for (const extension of Object.keys(fileTypes)) {
      const name = `file.${extension}`;
      const expected = utils.getAttributes({ name }, {});
      const actual = documentMetadata({ name });
      assert.equal(actual.mime_type, expected.mimeType, extension);
      assert.deepEqual(
        actual.attributes.map((value) =>
          Buffer.from(gramRequest(Vendor, requestOf(value)).getBytes())
        ),
        expected.attrs.map((value) => Buffer.from(value.getBytes())),
        extension
      );
    }
  });

  it(`compares actual ${style} thumbnail upload bytes and resulting media`, async () => {
    const requests = [];
    const save = async (request) => {
      requests.push(request);
      return true;
    };
    const manager = {
      register: (uploader) => {
        uploader.resource.limit = 65536;
      },
      unregister: () => {},
      update: () => {},
    };
    const sdk = {
      session: { dcId: 2 },
      getSender: async () => ({ send: save, isConnected: () => true }),
      _files: {
        maxPartSize: 65536,
        maxUploadParts: async () => 4000,
        manager: () => manager,
        run: async (type, dc, create) => save(create()),
      },
    };
    const thumb = Buffer.from([9, 8, 7]);
    const expected = await uploads._fileToMedia(sdk, {
      file: gramRequest(Vendor, requestOf(file)),
      thumb,
    });
    assert.equal(requests.length, 1);
    const calls = [];
    const client = new Anygram({
      adapters: [
        createAdapter(
          'native',
          {
            call: async (method, params) => {
              calls.push({ _: method, ...params });
              return method === 'upload.saveFilePart'
                ? true
                : { _: 'updatesTooLong' };
            },
          },
          { kind: 'mtproto' }
        ),
      ],
    });
    await client[style].sendFile(peer, {
      file,
      thumb: new InputFile(thumb, 'unnamed'),
    });
    assert.equal(calls.length, 2);
    requests[0].fileId = calls[0].file_id;
    expected.media.thumb.id = calls[1].media.thumb.id;
    // GramJS deliberately leaves thumbnail md5Checksum empty; owned uploads
    // retain their real checksum. Compare that documented difference separately.
    if (style === 'gramjs') {
      assert.equal(expected.media.thumb.md5Checksum, '');
      assert.equal(
        calls[1].media.thumb.md5_checksum,
        '0c8e83d7bd4e4d5e9c170932482c3264'
      );
      expected.media.thumb.md5Checksum = calls[1].media.thumb.md5_checksum;
    }
    assert.deepEqual(
      Buffer.from(gramRequest(Vendor, requestOf(calls[0])).getBytes()),
      Buffer.from(requests[0].getBytes())
    );
    assert.deepEqual(
      Buffer.from(gramRequest(Vendor, requestOf(calls[1].media)).getBytes()),
      Buffer.from(expected.media.getBytes())
    );
  });

  it(`sends ${style} inferred images, thumbnails, album flags and bound replacements over encrypted TCP`, async () => {
    const calls = [];
    const remote = await secretRpcPeer((request) => {
      calls.push(request);
      if (request._ === 'messages.getHistory') {
        return messagePage();
      }
      if (request._ === 'upload.saveFilePart') {
        return true;
      }
      if (request._ === 'messages.uploadMedia') {
        const isPhoto = request.media._.includes('Photo');
        const ref = {
          id: 9007199254740993n,
          access_hash: -9007199254740995n,
          file_reference: new Uint8Array([1, 2]),
          date: 1,
          dc_id: 2,
        };
        return isPhoto
          ? { _: 'messageMediaPhoto', photo: { _: 'photo', ...ref, sizes: [] } }
          : {
              _: 'messageMediaDocument',
              document: {
                _: 'document',
                ...ref,
                mime_type: 'text/plain',
                size: 1n,
                attributes: [],
              },
            };
      }
      return { _: 'updatesTooLong' };
    });
    const client = new Anygram({
      adapters: [createAdapter('native', remote.client, { kind: 'mtproto' })],
    });
    try {
      const [message] = await client[style].getMessages(peer);
      await client[style].sendFile(peer, {
        file,
        thumb: new InputFile(new Uint8Array([1, 2]), 'thumb.jpg'),
        spoiler: true,
        ttlSeconds: 0,
      });
      const image = { ...file, name: 'photo.png' };
      await client[style].sendAlbum(peer, [
        { file: image, spoiler: true, ttlSeconds: 9 },
        { file, forceDocument: true, ttlSeconds: 0 },
      ]);
      await message.reply({ file: image, spoiler: true });
      await message.edit({ file: image, spoiler: true });
      assert.deepEqual(
        calls.map((request) => request._),
        [
          'messages.getHistory',
          'upload.saveFilePart',
          'messages.sendMedia',
          'messages.uploadMedia',
          'messages.uploadMedia',
          'messages.sendMultiMedia',
          'messages.sendMedia',
          'messages.editMessage',
        ]
      );
      assert.equal(calls[2].media.thumb.name, 'thumb.jpg');
      assert.equal(calls[2].media.ttl_seconds, 0);
      const album = calls[5].multi_media;
      assert.equal(album[0].media.id.id, 9007199254740993n);
      assert.equal(album[0].media.id.access_hash, -9007199254740995n);
      assert.equal(album[0].media.spoiler, true);
      assert.equal(album[0].media.ttl_seconds, 9);
      assert.equal(album[1].media.ttl_seconds, 0);
      for (const request of calls.slice(-2)) {
        assert.equal(request.media._, 'inputMediaUploadedPhoto');
        assert.equal(request.media.spoiler, true);
        assert.equal(request.peer.access_hash, 17n);
      }
    } finally {
      await client.disconnect();
      await remote.close();
    }
  });
}

for (const kind of ['gramjs', 'teleproto', 'mtcute', 'mtproto', 'native']) {
  for (const failed of [false, true]) {
    it(`keeps media metadata on the selected ${kind} route with ${failed ? 'failed' : 'successful'} submission`, async () => {
      const calls = [];
      const accept = (request) => {
        request = objectRequest(requestOf(request));
        calls.push(request);
        assert.equal(request.media._, 'inputMediaUploadedDocument');
        assert.equal(request.media.force_file, true);
        assert.equal(request.media.mime_type, 'text/plain');
        assert.equal(request.media.thumb.name, 'thumb.jpg');
        if (failed) {
          throw Object.assign(new Error('CHAT_WRITE_FORBIDDEN'), { code: 403 });
        }
        return { _: 'updatesTooLong' };
      };
      const Vendor = kind === 'gramjs' ? GramApi : TeleApi;
      const client = new Anygram({
        backend: kind,
        adapters: [
          createAdapter(
            'unused',
            { call: () => assert.fail('Media replayed') },
            { kind: 'mtproto' }
          ),
          createAdapter(
            kind,
            {
              sendFile: () => assert.fail('Shared media preparation bypassed'),
              invoke: async (request) =>
                accept(objectRequest(requestOf(request))),
              call: async (method, params) =>
                accept(
                  typeof method === 'string' ? { _: method, ...params } : method
                ),
            },
            { kind: kind === 'native' ? 'mtproto' : kind, Api: Vendor }
          ),
        ],
      });
      const result = client.teleproto.sendFile(peer, {
        file,
        forceDocument: true,
        thumb: { ...file, name: 'thumb.jpg' },
      });
      if (failed) {
        await assert.rejects(result, {
          type: 'CHAT_WRITE_FORBIDDEN',
          code: 403,
          backend: kind,
        });
      } else {
        await result;
      }
      assert.equal(calls.length, 1);
    });
  }
}
