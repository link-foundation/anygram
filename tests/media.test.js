import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Anygram, createAdapter } from '../src/index.js';
const clientFor = (call) =>
  new Anygram({ adapters: [createAdapter('mtproto', { call })] });

it('refreshes expired document references from the origin message and uses its advertised size (mtcute #40)', async () => {
  const document = {
    _: 'document',
    id: 8n,
    access_hash: 9n,
    file_reference: new Uint8Array([1]),
    size: 3n,
    dc_id: 4,
  };
  const origin = {
    _: 'message',
    id: 12,
    peer_id: { _: 'peerChat', chat_id: 7n },
    media: { _: 'messageMediaDocument', document },
  };
  const calls = [];
  const client = clientFor(async (method, params) => {
    calls.push(method);
    if (method === 'messages.getMessages') {
      assert.equal(params.id[0].id, 12);
      return {
        messages: [
          {
            ...origin,
            media: {
              ...origin.media,
              document: { ...document, file_reference: new Uint8Array([2]) },
            },
          },
        ],
      };
    }
    assert.equal(method, 'upload.getFile');
    if (params.location.file_reference[0] === 1) {
      throw new Error('FILE_REFERENCE_EXPIRED');
    }
    return { _: 'upload.file', bytes: new Uint8Array([1, 2, 3]) };
  });
  assert.deepEqual([...(await client.downloadMedia(origin))], [1, 2, 3]);
  assert.deepEqual(calls, [
    'upload.getFile',
    'messages.getMessages',
    'upload.getFile',
  ]);
  const truncated = clientFor(async () => ({
    _: 'upload.file',
    bytes: new Uint8Array([1]),
  }));
  await assert.rejects(truncated.downloadMedia(origin), /advertised size/);
});

it('downloads profile photos through a shared InputPeerPhotoFileLocation', async () => {
  const client = clientFor(async (method, params) => {
    if (method === 'users.getUsers') {
      return [
        {
          _: 'user',
          id: 1n,
          self: true,
          photo: {
            _: 'userProfilePhoto',
            photo_id: 6n,
            dc_id: 2,
          },
        },
      ];
    }
    assert.equal(params.location._, 'inputPeerPhotoFileLocation');
    assert.equal(params.location.photo_id, 6n);
    assert.equal(params.location.peer._, 'inputPeerSelf');
    assert.equal(params.location.big, false);
    return { _: 'upload.file', bytes: new Uint8Array([4, 5]) };
  });
  assert.deepEqual(
    [...(await client.downloadProfilePhoto('me', { big: false }))],
    [4, 5]
  );
});
describe('shared bounded media operations', () => {
  it('uploads numbered parts and sends one media RPC with a checksum', async () => {
    const data = new Uint8Array(1025).fill(42);
    const parts = [];
    let sent;
    const client = clientFor(async (method, params) => {
      if (method === 'upload.saveFilePart') {
        parts.push(params);
        return true;
      }
      assert.equal(method, 'messages.sendMedia');
      sent = params;
      return {
        _: 'updates',
        updates: [],
        users: [],
        chats: [],
        date: 1,
        seq: 1,
      };
    });
    await client.sendFile('me', {
      file: { data, filename: 'test.txt' },
      partSize: 1024,
      caption: 'hello',
    });
    assert.deepEqual(
      parts.map((p) => [p.file_part, p.bytes.length]),
      [
        [0, 1024],
        [1, 1],
      ]
    );
    assert.equal(
      sent.media.file.md5_checksum,
      createHash('md5').update(data).digest('hex')
    );
    assert.equal(sent.media.file.parts, 2);
    assert.equal(sent.media.attributes[0].file_name, 'test.txt');
    assert.equal(sent.message, 'hello');
  });
  it('downloads exact bytes and refreshes an expired file reference without restarting', async () => {
    const data = new Uint8Array(5000).fill(7);
    let refreshed = false;
    let count = 0;
    const client = clientFor(async (method, params) => {
      assert.equal(method, 'upload.getFile');
      count++;
      if (params.location.file_reference[0] === 1) {
        throw Object.assign(new Error('FILE_REFERENCE_EXPIRED'), {
          type: 'FILE_REFERENCE_EXPIRED',
        });
      }
      return { _: 'upload.file', bytes: data };
    });
    const location = {
      _: 'inputDocumentFileLocation',
      id: 1n,
      access_hash: 2n,
      file_reference: new Uint8Array([1]),
      thumb_size: '',
    };
    const result = await client.downloadMedia(location, {
      size: 5000,
      refreshFileReference: () => {
        refreshed = true;
        return { ...location, file_reference: new Uint8Array([2]) };
      },
    });
    assert.deepEqual(result, data);
    assert.equal(refreshed, true);
    assert.equal(count, 2);
  });
  it('rejects oversized uploads and downloads before allocating unbounded buffers', async () => {
    const client = clientFor(async () =>
      assert.fail('Invalid upload reached network')
    );
    await assert.rejects(
      client.sendFile('me', { file: new Uint8Array(3), partSize: 1 }),
      /part size/i
    );
    await assert.rejects(
      client.downloadMedia(
        { _: 'inputDocumentFileLocation' },
        { size: 100, maxBytes: 10 }
      ),
      /limit/i
    );
  });
});
it('streams chunks without returning a Promise of an iterator', async () => {
  const client = clientFor(async () => ({
    _: 'upload.file',
    bytes: new Uint8Array([1, 2, 3]),
  }));
  const chunks = [];
  for await (const chunk of client.iterDownload(
    { _: 'inputDocumentFileLocation' },
    { size: 3 }
  )) {
    chunks.push([...chunk]);
  }
  assert.deepEqual(chunks, [[1, 2, 3]]);
});
it('rejects a truncated download instead of returning incomplete media', async () => {
  const client = clientFor(async () => ({
    _: 'upload.file',
    bytes: new Uint8Array(2),
  }));
  await assert.rejects(
    client.downloadMedia({ _: 'inputDocumentFileLocation' }, { size: 3 }),
    /advertised size/
  );
});
it('converts uploaded photos to persistent media before sending an album (mtproto-core #148)', async () => {
  const calls = [];
  const client = clientFor(async (method, params) => {
    calls.push([method, params]);
    if (method === 'upload.saveFilePart') {
      return true;
    }
    if (method === 'messages.uploadMedia') {
      return {
        _: 'messageMediaPhoto',
        photo: {
          _: 'photo',
          id: BigInt(calls.length),
          access_hash: 9n,
          file_reference: new Uint8Array([3]),
        },
      };
    }
    assert.equal(method, 'messages.sendMultiMedia');
    assert.equal(params.multi_media.length, 2);
    assert.deepEqual(
      params.multi_media.map((item) => item.message),
      ['first', '']
    );
    for (const item of params.multi_media) {
      assert.equal(item.media._, 'inputMediaPhoto');
    }
    return { _: 'updates', updates: [], chats: [], users: [] };
  });
  await client.sendFile('me', {
    file: [new Uint8Array([1]), new Uint8Array([2])],
    caption: ['first', ''],
    forceDocument: false,
  });
  assert.deepEqual(
    calls.map(([method]) => method),
    [
      'upload.saveFilePart',
      'messages.uploadMedia',
      'upload.saveFilePart',
      'messages.uploadMedia',
      'messages.sendMultiMedia',
    ]
  );
});
