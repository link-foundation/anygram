import assert from 'node:assert/strict';
import { mkdtemp, open, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Anygram, createAdapter, InputFile } from '../src/index.js';

// A finite sparse file, sixteen half-MiB parts at a time, under a 64 MiB heap.
const size = 48 * 1024 * 1024;
const root = await mkdtemp(join(tmpdir(), 'anygram-upload-budget-'));
try {
  const path = join(root, 'sparse.bin');
  const file = await open(path, 'w');
  try {
    await file.truncate(size);
  } finally {
    await file.close();
  }
  let parts = 0,
    length = 0;
  const client = new Anygram({
    adapters: [
      createAdapter(
        'native',
        {
          call: (method, params) => {
            assert.equal(method, 'upload.saveBigFilePart');
            assert.equal(params.file_part, parts++);
            assert(params.bytes instanceof Uint8Array);
            assert.equal(params.bytes.length, 512 * 1024);
            assert.equal(params.bytes[0], 0);
            assert.equal(params.bytes.at(-1), 0);
            length += params.bytes.length;
            return true;
          },
        },
        { kind: 'mtproto' }
      ),
    ],
  });
  const result = await client.gramjs.uploadFile({
    file: new InputFile(() => path),
    fileSize: size,
    maxBufferSize: 0,
    workers: 16,
    maxBytes: size,
  });
  assert.equal(result.className, 'InputFileBig');
  assert.equal(result.name, 'sparse.bin');
  assert.equal(result.parts, 96);
  assert.equal(parts, 96);
  assert.equal(length, size);
  console.log(
    JSON.stringify({ size, parts, maxRSSKiB: process.resourceUsage().maxRSS })
  );
} finally {
  await rm(root, { recursive: true, force: true });
}
