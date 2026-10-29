import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { IGE } from 'telegram/crypto/IGE.js';
import { Anygram, createAdapter } from '../src/index.js';
import * as protocol from '../src/mtproto.js';

const checksum = (bytes) => createHash('md5').update(bytes).digest('hex');
const fingerprint = (key, iv) => {
  const digest = createHash('md5').update(key).update(iv).digest();
  return digest.readInt32LE(0) ^ digest.readInt32LE(4);
};
const storedFile = (upload, data) => ({
  _: 'encryptedFile',
  id: upload.file.id,
  access_hash: -7n,
  size: BigInt(data.length),
  dc_id: 4,
  key_fingerprint: upload.file.key_fingerprint,
});

it('uploads encrypted parts with independent one-time keys, continuous IGE and a ciphertext checksum', async () => {
  const input = Uint8Array.from({ length: 1025 }, (_, i) => i % 256);
  const parts = [];
  const progress = [];
  const invoke = async (method, params) => {
    assert.equal(method, 'upload.saveFilePart');
    parts.push({ ...params, bytes: Uint8Array.from(params.bytes) });
    return true;
  };
  const upload = await protocol.uploadEncryptedFile(
    invoke,
    { data: input, filename: 'test.bin' },
    {
      partSize: 1024,
      onProgress: (done, total) => progress.push([done, total]),
    }
  );
  assert.equal(upload.size, input.length);
  assert.equal(upload.name, 'test.bin');
  assert.equal(upload.file._, 'inputEncryptedFileUploaded');
  assert.equal(upload.file.parts, 2);
  assert.equal(upload.key.length, 32);
  assert.equal(upload.iv.length, 32);
  assert.equal(upload.file.key_fingerprint, fingerprint(upload.key, upload.iv));
  assert.deepEqual(
    parts.map((p) => [p.file_part, p.bytes.length]),
    [
      [0, 1024],
      [1, 16],
    ]
  );
  assert.ok(parts.every((part) => part.file_id === upload.file.id));
  const data = Buffer.concat(parts.map((part) => part.bytes));
  assert.equal(upload.file.md5_checksum, checksum(data));
  const plain = new IGE(
    Buffer.from(upload.key),
    Buffer.from(upload.iv)
  ).decryptIge(data);
  assert.deepEqual(Uint8Array.from(plain.subarray(0, input.length)), input);
  assert.deepEqual(progress, [
    [1024, 1025],
    [1025, 1025],
  ]);
  const second = await protocol.uploadEncryptedFile(invoke, input);
  assert.notDeepEqual(second.key, upload.key);
  assert.notDeepEqual(second.iv, upload.iv);
  assert.notEqual(second.file.id, upload.file.id);
  assert.deepEqual(
    input,
    Uint8Array.from({ length: 1025 }, (_, i) => i % 256)
  );
});

it('downloads encrypted files from their DC with continuous decryption and strips only final padding', async () => {
  const input = new Uint8Array(512 * 1024 + 13).fill(19);
  const pieces = [];
  const upload = await protocol.uploadEncryptedFile(async (_, params) => {
    pieces.push(Uint8Array.from(params.bytes));
    return true;
  }, input);
  const data = Buffer.concat(pieces);
  const descriptor = { ...upload, file: storedFile(upload, data) };
  const calls = [];
  const invoke = async (method, params, options) => {
    calls.push(params);
    assert.equal(method, 'upload.getFile');
    assert.equal(params.location._, 'inputEncryptedFileLocation');
    assert.equal(params.location.access_hash, -7n);
    assert.equal(options.dc, 4);
    assert.equal(params.cdn_supported, false);
    const offset = Number(params.offset);
    return {
      _: 'upload.file',
      bytes: data.subarray(offset, offset + params.limit),
    };
  };
  const chunks = [];
  for await (const chunk of protocol.iterDownloadEncryptedFile(
    invoke,
    descriptor
  )) {
    chunks.push(chunk);
  }
  assert.deepEqual(Buffer.concat(chunks), Buffer.from(input));
  assert.deepEqual(
    calls.map((call) => call.offset),
    [0n, 524288n]
  );
  assert.deepEqual(
    await protocol.downloadEncryptedFile(invoke, descriptor),
    Buffer.from(input)
  );
});

it('shares encrypted file upload and download through raw-capable Anygram backends', async () => {
  const parts = [];
  const client = new Anygram({
    adapters: [
      createAdapter('mtproto', {
        call: async (method, params) => {
          if (method === 'upload.saveFilePart') {
            parts.push(Uint8Array.from(params.bytes));
            return true;
          }
          return { _: 'upload.file', bytes: Buffer.concat(parts) };
        },
      }),
    ],
  });
  const data = new Uint8Array([1, 2, 3]);
  const upload = await client.uploadEncryptedFile(data);
  const descriptor = {
    ...upload,
    file: storedFile(upload, Buffer.concat(parts)),
  };
  assert.deepEqual(
    await client.downloadEncryptedFile(descriptor),
    Buffer.from(data)
  );
  const chunks = [];
  for await (const chunk of client.iterDownloadEncryptedFile(descriptor)) {
    chunks.push(chunk);
  }
  assert.deepEqual(Buffer.concat(chunks), Buffer.from(data));
});

it('uses big encrypted uploads beyond 10 MiB and never returns a plaintext checksum', async () => {
  const input = new Uint8Array(10 * 1024 * 1024 + 1).fill(37);
  let count = 0;
  let bytes = 0;
  const upload = await protocol.uploadEncryptedFile(async (method, params) => {
    assert.equal(method, 'upload.saveBigFilePart');
    assert.equal(params.file_total_parts, 21);
    assert.equal(params.file_part, count++);
    bytes += params.bytes.length;
    return true;
  }, input);
  assert.equal(upload.file._, 'inputEncryptedFileBigUploaded');
  assert.equal(upload.file.parts, 21);
  assert.equal(upload.file.md5_checksum, undefined);
  assert.equal(count, 21);
  assert.equal(bytes, input.length + 15);
});

it('rejects invalid part sizes and bounds before sending encrypted uploads', async () => {
  let calls = 0;
  const invoke = async () => {
    calls++;
    return true;
  };
  for (const [data, options] of [
    [new Uint8Array(), {}],
    [new Uint8Array(1), { partSize: 1000 }],
    [new Uint8Array(1025), { partSize: 1024, maxParts: 1 }],
    [new Uint8Array(1), { maxParts: 0 }],
  ]) {
    await assert.rejects(
      protocol.uploadEncryptedFile(invoke, data, options),
      RangeError
    );
  }
  assert.equal(calls, 0);
  await assert.rejects(
    protocol.uploadEncryptedFile(async () => false, new Uint8Array(1)),
    /did not save/
  );
  const controller = new globalThis.AbortController();
  await assert.rejects(
    protocol.uploadEncryptedFile(invoke, new Uint8Array(2048), {
      partSize: 1024,
      signal: controller.signal,
      onProgress: () => controller.abort(new Error('stop uploading')),
    }),
    /stop uploading/
  );
  assert.equal(calls, 1);
});

it('encrypts Blob and local file sources without changing source bytes', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anygram-secret-file-'));
  const input = new Uint8Array([2, 4, 6, 8, 10]);
  const path = join(directory, 'test.bin');
  await writeFile(path, input);
  try {
    for (const source of [new globalThis.Blob([input]), path]) {
      let encrypted;
      const uploaded = await protocol.uploadEncryptedFile(async (_, params) => {
        encrypted = Buffer.from(params.bytes);
        return true;
      }, source);
      const plain = new IGE(
        Buffer.from(uploaded.key),
        Buffer.from(uploaded.iv)
      ).decryptIge(encrypted);
      assert.deepEqual(plain.subarray(0, input.length), Buffer.from(input));
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

async function smallFile() {
  let data;
  const upload = await protocol.uploadEncryptedFile(
    async (_, params) => {
      data = Buffer.from(params.bytes);
      return true;
    },
    new Uint8Array([5, 6, 7])
  );
  return { descriptor: { ...upload, file: storedFile(upload, data) }, data };
}

it('validates encrypted file metadata, keys and limits before downloading', async () => {
  const { descriptor } = await smallFile();
  const bad = [
    { key: new Uint8Array(31) },
    { iv: new Uint8Array(33) },
    { size: -1 },
    { size: 0 },
    { size: 1.5 },
    { size: Number.MAX_SAFE_INTEGER },
    {
      file: {
        ...descriptor.file,
        key_fingerprint: descriptor.file.key_fingerprint ^ 1,
      },
    },
    { file: { ...descriptor.file, size: 3n } },
    { file: { ...descriptor.file, dc_id: 0 } },
  ];
  let calls = 0;
  const invoke = async () => {
    calls++;
  };
  for (const patch of bad) {
    await assert.rejects(
      protocol.downloadEncryptedFile(invoke, { ...descriptor, ...patch })
    );
  }
  await assert.rejects(
    protocol.downloadEncryptedFile(invoke, descriptor, { maxBytes: 2 }),
    /limit/
  );
  assert.equal(calls, 0);
});

it('rejects truncated, oversized, malformed and redirected encrypted downloads', async () => {
  const { descriptor, data } = await smallFile();
  for (const response of [
    { _: 'upload.file', bytes: data.subarray(0, 15) },
    { _: 'upload.file', bytes: Buffer.concat([data, data]) },
    { _: 'upload.file', bytes: [] },
    { _: 'upload.fileCdnRedirect', bytes: data },
    undefined,
  ]) {
    await assert.rejects(
      protocol.downloadEncryptedFile(async () => response, descriptor),
      /encrypted file chunk/
    );
  }
});

it('takes owned key material, honors early iterator closure and cancellation', async () => {
  const { descriptor, data } = await smallFile();
  const controller = new globalThis.AbortController();
  const calls = [];
  const iterator = protocol.iterDownloadEncryptedFile(
    async (_, __, options) => {
      calls.push(options);
      descriptor.key.fill(0);
      descriptor.iv.fill(0);
      return { _: 'upload.file', bytes: data };
    },
    descriptor,
    { dc: 2, signal: controller.signal }
  );
  assert.deepEqual((await iterator.next()).value, Buffer.from([5, 6, 7]));
  await iterator.return();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].dc, 4);
  const fresh = await smallFile();
  await assert.rejects(
    protocol.downloadEncryptedFile(
      async () => {
        controller.abort(new Error('stop downloading'));
        return { _: 'upload.file', bytes: fresh.data };
      },
      fresh.descriptor,
      { signal: controller.signal }
    ),
    /stop downloading/
  );
});
