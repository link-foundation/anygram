import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Anygram, createAdapter } from '../src/index.js';
const clientFor = (call) =>
  new Anygram({ adapters: [createAdapter('mtproto', { call })] });
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
