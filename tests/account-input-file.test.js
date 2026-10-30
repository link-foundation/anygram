import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { Readable } from 'node:stream';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { Anygram, createAdapter, InputFile } from '../src/index.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import { __tlWriterMap } from '../node_modules/@mtcute/core/tl/binary/writer.js';
import { TlBinaryWriter } from '@mtcute/tl-runtime';
import { TlCodec } from '../src/tl.js';
import { uploadEncryptedFile } from '../src/secret-files.js';

const bytes = new Uint8Array(1025).fill(42);
const account = (call) =>
  new Anygram({ adapters: [createAdapter('mtproto', { call })] });

it('uses reusable owned suppliers for account uploads with filenames and exact numbered parts', async () => {
  const calls = [];
  const client = account(async (method, params) => {
    calls.push({ method, params });
    return true;
  });
  let supplied = 0;
  const input = new InputFile(() => {
    supplied++;
    return [bytes];
  }, 'account.bin');
  for (let index = 0; index < 2; index++) {
    const result = await client.uploadFile(input, { partSize: 1024 });
    assert.equal(result.name, 'account.bin');
    assert.equal(result.parts, 2);
    assert.equal(
      result.md5_checksum,
      createHash('md5').update(bytes).digest('hex')
    );
  }
  assert.equal(supplied, 2);
  assert.deepEqual(
    calls.map(({ params }) => params.bytes.length),
    [1024, 1, 1024, 1]
  );
});

it('bounds owned account sources by bytes and configured part capacity before any RPC', async () => {
  let closed = 0;
  const client = account(async () =>
    assert.fail('Oversized source reached RPC')
  );
  function* stream() {
    try {
      yield bytes;
    } finally {
      closed++;
    }
  }
  for (const options of [{ maxBytes: 1024 }, { partSize: 1024, maxParts: 1 }]) {
    await assert.rejects(
      client.uploadFile(new InputFile(stream()), options),
      /byte limit/
    );
  }
  assert.equal(closed, 2);
});

it('validates owned upload part settings before invoking a supplier', async () => {
  let supplied = 0;
  const client = account(async () =>
    assert.fail('Invalid settings reached RPC')
  );
  for (const options of [{ partSize: 1 }, { maxParts: 0 }]) {
    await assert.rejects(
      client.uploadFile(
        new InputFile(() => {
          supplied++;
          return bytes;
        }),
        options
      ),
      /part size|part limit/i
    );
  }
  assert.equal(supplied, 0);
});

it('preserves cancellation while account preparation waits for a supplier and cleans late sources', async () => {
  let release,
    entered,
    closed = 0;
  const source = new Promise((resolve) => {
    release = resolve;
  });
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const controller = new globalThis.AbortController();
  const watchdog = globalThis.setTimeout(
    () => controller.abort(new Error('Finite account probe expired')),
    500
  );
  const client = account(async () =>
    assert.fail('Cancelled source reached RPC')
  );
  try {
    const pending = client.uploadFile(
      new InputFile(() => {
        entered();
        return source;
      }),
      { signal: controller.signal }
    );
    await Promise.race([ready, pending]);
    const reason = new Error('Account source cancelled');
    controller.abort(reason);
    await assert.rejects(pending, (error) => error.cause === reason);
    release({
      return() {
        closed++;
      },
      [Symbol.asyncIterator]() {
        return this;
      },
    });
    await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
    assert.equal(closed, 1);
  } finally {
    globalThis.clearTimeout(watchdog);
    controller.abort();
    release(bytes);
  }
});

it('keeps an explicitly streamed account InputFile single-use', async () => {
  let calls = 0;
  const client = account(async () => {
    calls++;
    return true;
  });
  const input = new InputFile(Readable.from([new Uint8Array([1])]));
  await client.uploadFile(input);
  await assert.rejects(client.uploadFile(input), /reuse|consumed/i);
  assert.equal(calls, 1);
});

for (const encrypted of [false, true]) {
  it(`keeps the owned ${encrypted ? 'encrypted' : 'cloud'} upload deadline active during source preparation`, async () => {
    let release;
    const source = new Promise((resolve) => {
      release = resolve;
    });
    const controller = new globalThis.AbortController();
    const watchdog = globalThis.setTimeout(
      () => controller.abort(new Error('Finite deadline probe expired')),
      500
    );
    const invoke = async () => assert.fail('Expired preparation reached RPC');
    try {
      const input = new InputFile(() => source);
      const options = { timeout: 10, signal: controller.signal };
      const pending = encrypted
        ? uploadEncryptedFile(invoke, input, options)
        : account(invoke).uploadFile(input, options);
      await assert.rejects(
        pending,
        (error) =>
          error.type === 'NETWORK_ERROR' && /timed out/i.test(error.message)
      );
    } finally {
      globalThis.clearTimeout(watchdog);
      controller.abort();
      release(bytes);
    }
  });
}

for (const encrypted of [false, true]) {
  for (const stage of ['RPC', 'progress callback']) {
    it(`bounds a noncooperating ${stage} during owned ${encrypted ? 'encrypted' : 'cloud'} upload`, async () => {
      let release,
        calls = 0;
      const blocked = new Promise((resolve) => {
        release = resolve;
      });
      const controller = new globalThis.AbortController();
      const watchdog = globalThis.setTimeout(
        () => controller.abort(new Error('Finite dispatch probe expired')),
        500
      );
      const invoke = () => {
        calls++;
        return stage === 'RPC' ? blocked : Promise.resolve(true);
      };
      const options = {
        timeout: 10,
        partSize: 1024,
        signal: controller.signal,
        onProgress: () => blocked,
      };
      try {
        const input = new InputFile(bytes);
        const pending = encrypted
          ? uploadEncryptedFile(invoke, input, options)
          : account(invoke).uploadFile(input, options);
        await assert.rejects(
          pending,
          (error) => error.type === 'NETWORK_ERROR'
        );
        release(true);
        await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
        assert.equal(calls, 1);
      } finally {
        globalThis.clearTimeout(watchdog);
        controller.abort();
        release(true);
      }
    });
  }
}

it('retains explicit upload filename overrides for owned account inputs', async () => {
  const client = account(async () => true);
  const result = await client.uploadFile(
    new InputFile(new Uint8Array([1]), 'original.bin'),
    { filename: 'override.bin' }
  );
  assert.equal(result.name, 'override.bin');
});

for (const [style, Api] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`routes owned file inputs through shared uploads using actual ${style} TL classes`, async () => {
    const calls = [];
    const client = new Anygram({
      adapters: [
        createAdapter(
          style,
          {
            sendFile: async () =>
              assert.fail('Owned file reached incompatible vendor sendFile'),
            uploadFile: async () =>
              assert.fail('Owned file reached incompatible vendor uploadFile'),
            invoke: async (request) => {
              calls.push(request);
              assert(request.getBytes().length > 0);
              if (request instanceof Api.upload.SaveFilePart) {
                return true;
              }
              assert(request instanceof Api.messages.SendMedia);
              return new Api.Updates({
                updates: [],
                users: [],
                chats: [],
                date: 1,
                seq: 1,
              });
            },
          },
          { Api }
        ),
      ],
    });
    await client.sendFile('me', {
      file: new InputFile(bytes, 'shared.bin'),
      partSize: 1024,
    });
    const result = await client.uploadFile(
      new InputFile(new Uint8Array([1]), 'direct.bin')
    );
    assert.equal(result.name, 'direct.bin');
    assert.equal(calls.length, 4);
    assert.equal(calls[2].media.attributes[0].fileName, 'shared.bin');
  });
}

it('shares account file preparation for paths, file URLs, Blobs, web streams and downloaded URLs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'anygram-account-input-'));
  const path = join(root, 'file with space.bin');
  let downloads = 0;
  const parts = [];
  const client = account(async (method, params) => {
    assert.equal(method, 'upload.saveFilePart');
    parts.push(params.bytes);
    return true;
  });
  const controller = new globalThis.AbortController();
  try {
    await writeFile(path, bytes);
    for (const source of [
      path,
      pathToFileURL(path),
      new globalThis.Blob([bytes]),
      new globalThis.ReadableStream({
        start(sink) {
          sink.enqueue(bytes);
          sink.close();
        },
      }),
      new globalThis.URL('https://files.invalid/account.bin'),
    ]) {
      await client.uploadFile(new InputFile(source), {
        signal: controller.signal,
        fetch: (url, options) => {
          downloads++;
          assert.equal(url, 'https://files.invalid/account.bin');
          assert(options.signal instanceof globalThis.AbortSignal);
          assert.equal(options.signal.aborted, controller.signal.aborted);
          assert.equal(options.headers, undefined);
          return Promise.resolve(new Response(bytes));
        },
      });
    }
    assert.equal(downloads, 1);
    assert.equal(parts.length, 5);
    assert(parts.every((part) => Buffer.from(part).equals(Buffer.from(bytes))));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('serializes owned account uploads through the actual mtcute binary writer', async () => {
  const codec = new TlCodec();
  const uploaded = [];
  const client = new Anygram({
    adapters: [
      createAdapter('mtcute', {
        uploadFile: async () => assert.fail('Owned file reached vendor helper'),
        call: async (request) => {
          const decoded = codec.decode(
            TlBinaryWriter.serializeObject(__tlWriterMap, request)
          );
          assert.equal(decoded._, 'upload.saveFilePart');
          uploaded.push(decoded.bytes);
          return true;
        },
      }),
    ],
  });
  const result = await client.uploadFile(
    new InputFile(() => [bytes], 'mtcute.bin')
  );
  assert.equal(result.name, 'mtcute.bin');
  assert.deepEqual(Buffer.concat(uploaded), Buffer.from(bytes));
});

for (const [style, Api] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`prepares mixed owned file albums using actual ${style} serializers`, async () => {
    const methods = [];
    const client = new Anygram({
      adapters: [
        createAdapter(
          style,
          {
            sendFile: async () =>
              assert.fail('Owned album reached vendor helper'),
            invoke: async (request) => {
              assert(request.getBytes().length > 0);
              methods.push(request.className);
              if (request instanceof Api.upload.SaveFilePart) {
                return true;
              }
              if (request instanceof Api.messages.UploadMedia) {
                return new Api.MessageMediaPhoto({
                  photo: new Api.Photo({
                    id: BigInt(methods.length),
                    accessHash: 9n,
                    fileReference: Buffer.from([1]),
                    date: 1,
                    sizes: [],
                    dcId: 2,
                  }),
                });
              }
              assert(request instanceof Api.messages.SendMultiMedia);
              assert.equal(request.multiMedia.length, 2);
              assert.deepEqual(
                request.multiMedia.map((item) => item.message),
                ['first', 'second']
              );
              return new Api.Updates({
                updates: [],
                users: [],
                chats: [],
                date: 1,
                seq: 1,
              });
            },
          },
          { Api }
        ),
      ],
    });
    await client.sendFile('me', {
      file: [
        {
          file: new InputFile(new Uint8Array([1]), 'owned.png'),
          caption: 'first',
        },
        { file: new Uint8Array([2]), caption: 'second' },
      ],
      forceDocument: false,
    });
    assert.equal(methods.length, 5);
  });
}

it('uploads owned account inputs through native encrypted TCP without serializing the wrapper', async () => {
  const parts = [];
  const peer = await secretRpcPeer((request) => {
    assert.equal(request._, 'upload.saveFilePart');
    parts.push(request.bytes);
    return true;
  });
  try {
    const client = new Anygram({
      adapters: [createAdapter('native', peer.client, { kind: 'mtproto' })],
    });
    const result = await client.uploadFile(
      new InputFile(() => [bytes], 'native.bin'),
      { partSize: 1024 }
    );
    assert.equal(result.name, 'native.bin');
    assert.deepEqual(Buffer.concat(parts), Buffer.from(bytes));
  } finally {
    await peer.close();
  }
});
