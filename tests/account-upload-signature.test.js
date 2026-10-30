import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import * as Public from '../src/index.js';
import * as GramUploads from 'telegram/client/uploads.js';
import * as TeleUploads from 'teleproto/client/methods/uploads.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { gramRequest, objectRequest, requestOf } from '../src/requests.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const peer = { _: 'inputPeerSelf' };
const bytes = new Uint8Array([1, 2, 3]);
function fixture(call = async () => true) {
  return new Public.Anygram({
    adapters: [Public.createAdapter('native', { call }, { kind: 'mtproto' })],
  });
}

for (const style of ['gramjs', 'teleproto']) {
  it(`supports the ${style} direct SDK upload signature and native class result`, async () => {
    const progress = [],
      calls = [];
    const client = fixture(async (method, params) => {
      calls.push({ _: method, ...params });
      return true;
    });
    const result = await client[style].uploadFile({
      file: new Public.InputFile(bytes, 'note.txt'),
      workers: 2,
      onProgress: (fraction) => progress.push(fraction),
    });
    assert(result instanceof Public.Api.InputFile);
    assert.equal(result.name, 'note.txt');
    assert.equal(
      result.md5Checksum,
      createHash('md5').update(bytes).digest('hex')
    );
    assert.deepEqual(progress, [0, 1]);
    assert.equal(calls.length, 1);
    assert.deepEqual(calls[0].bytes, bytes);
  });

  it(`validates ${style} upload cancellation before consuming reusable suppliers`, async () => {
    let consumed = 0;
    const onProgress = () => {};
    onProgress.isCanceled = true;
    const client = fixture(() => assert.fail('Cancelled upload reached RPC'));
    await assert.rejects(
      client[style].uploadFile({
        file: new Public.InputFile(() => {
          consumed++;
          return bytes;
        }),
        workers: 1,
        onProgress,
      }),
      /USER_CANCELED/
    );
    assert.equal(consumed, 0);
  });

  it(`awaits ${style} fractional callbacks and observes cancellation after a saved part`, async () => {
    const progress = [],
      calls = [];
    const onProgress = async (fraction) => {
      await Promise.resolve();
      progress.push(fraction);
      if (fraction > 0) {
        onProgress.isCanceled = true;
      }
    };
    const client = fixture(async (method, params) => {
      calls.push(params.file_part);
      return true;
    });
    await assert.rejects(
      client[style].uploadFile({
        file: new Uint8Array(2048),
        workers: 1,
        partSize: 1024,
        onProgress,
      }),
      /USER_CANCELED/
    );
    assert.deepEqual(progress, [0, 0.5]);
    assert.deepEqual(calls, [0]);
  });

  it(`keeps ${style} high-level-only upload backends available`, async () => {
    const options = { file: bytes, workers: 1 };
    const client = new Public.Anygram({
      adapters: [
        Public.createAdapter(
          style,
          {
            uploadFile: async (value) => {
              assert.equal(value, options);
              return new TeleApi.InputFile({
                id: 7n,
                parts: 1,
                name: 'file',
                md5Checksum: '',
              });
            },
          },
          { Api: TeleApi }
        ),
      ],
    });
    assert(
      (await client[style].uploadFile(options)) instanceof Public.Api.InputFile
    );
  });
}

it('accepts SDK upload records through the canonical API while preserving raw canonical results', async () => {
  const progress = [];
  const result = await fixture().uploadFile({
    file: bytes,
    workers: 1,
    onProgress: (value) => progress.push(value),
  });
  assert.equal(result._, 'inputFile');
  assert.equal(result.className, undefined);
  assert.deepEqual(progress, [0, 1]);
});

for (const [name, bad] of [
  ['fileSize', -1],
  ['fileSize', 1.5],
  ['fileSize', Infinity],
  ['fileSize', '3'],
  ['maxBufferSize', -1],
  ['maxBufferSize', 1.5],
  ['maxBufferSize', Infinity],
  ['maxBufferSize', '3'],
]) {
  it(`rejects invalid ${name} ${bad} before opening sources or making RPCs`, async () => {
    let consumed = 0;
    await assert.rejects(
      fixture(() => assert.fail('Invalid hint reached RPC')).uploadFile(
        new Public.InputFile(() => {
          consumed++;
          return bytes;
        }),
        { [name]: bad }
      ),
      new RegExp(name)
    );
    assert.equal(consumed, 0);
  });
}

for (const kind of ['bytes', 'blob', 'record', 'random-access', 'input']) {
  it(`rejects a mismatched declared size for ${kind} before progress and RPC`, async () => {
    let read = 0,
      closed = 0,
      progress = 0;
    const source = {
      bytes,
      blob: new globalThis.Blob([bytes]),
      record: { data: bytes },
      'random-access': {
        size: 3,
        read: () => {
          read++;
          return bytes;
        },
        close: () => {
          closed++;
        },
      },
      input: new Public.InputFile(bytes),
    }[kind];
    await assert.rejects(
      fixture(() => assert.fail('Mismatched source reached RPC')).uploadFile(
        source,
        { fileSize: 4, progressCallback: () => progress++ }
      ),
      /fileSize|file size/i
    );
    assert.equal(progress, 0);
    assert.equal(read, 0);
    assert.equal(closed, kind === 'random-access' ? 1 : 0);
  });
}

it('preflights a later album declared-size mismatch before any source consumption', async () => {
  let consumed = 0;
  const client = fixture(() => assert.fail('Invalid album reached RPC'));
  await assert.rejects(
    client.sendAlbum(peer, [
      new Public.InputFile(() => {
        consumed++;
        return bytes;
      }),
      { file: bytes, fileSize: 4 },
    ]),
    /fileSize|file size/i
  );
  assert.equal(consumed, 0);
});

it('keeps main file size hints out of thumbnail uploads', async () => {
  const calls = [];
  await fixture(async (method, params) => {
    calls.push({ _: method, ...params });
    return method.startsWith('upload.') ? true : { _: 'updatesTooLong' };
  }).sendFile(peer, {
    file: bytes,
    fileSize: 3,
    thumb: new Uint8Array([9]),
    forceDocument: true,
  });
  assert.deepEqual(
    calls.filter((x) => x._.startsWith('upload.')).map((x) => x.bytes.length),
    [3, 1]
  );
});

for (const mode of ['path', 'file-url', 'supplier']) {
  it(`uses random-access ${mode} InputFile preparation without whole-file buffering`, async () => {
    const root = await mkdtemp(join(tmpdir(), 'anygram-upload-path-'));
    try {
      const path = join(root, 'note.txt');
      await writeFile(path, bytes);
      const source =
        mode === 'file-url'
          ? pathToFileURL(path)
          : mode === 'supplier'
            ? () => path
            : path;
      const result = await fixture().uploadFile(new Public.InputFile(source), {
        maxBufferSize: 0,
        fileSize: 3,
      });
      assert.equal(result.parts, 1);
      assert.equal(result.name, 'note.txt');
      assert.equal(
        result.md5_checksum,
        createHash('md5').update(bytes).digest('hex')
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}

it('bounds fallback stream buffering and closes the rejected iterator', async () => {
  let closed = 0;
  const input = new Public.InputFile(
    (async function* () {
      try {
        yield bytes;
      } finally {
        closed++;
      }
    })()
  );
  await assert.rejects(
    fixture(() => assert.fail('Oversized buffer reached RPC')).uploadFile(
      input,
      { maxBufferSize: 2 }
    ),
    /byte limit|buffer/i
  );
  assert.equal(closed, 1);
});

it('bounds fallback HTTP buffering before dispatch and preserves the selected fetcher', async () => {
  let fetched = 0;
  const fetch = async () => {
    fetched++;
    return new Response(bytes, { headers: { 'content-length': '3' } });
  };
  await assert.rejects(
    fixture(() => assert.fail('Oversized HTTP buffer reached RPC')).uploadFile(
      new Public.InputFile(new globalThis.URL('https://example.test/file')),
      { maxBufferSize: 2, fetch }
    ),
    /byte limit|buffer/i
  );
  assert.equal(fetched, 1);
});

it('retains supplied-buffer uploads when the fallback buffering budget is zero', async () => {
  const result = await fixture().uploadFile(new Public.InputFile(bytes), {
    maxBufferSize: 0,
  });
  assert.equal(result.parts, 1);
});

it('honors direct random-access upload deadlines and closes a pending finite read', async () => {
  let closed = 0,
    finished;
  const pending = new Promise((resolve) => {
    finished = resolve;
  });
  let timer;
  const source = {
    size: bytes.length,
    read: () => {
      timer = globalThis.setTimeout(() => finished(bytes), 100);
      return pending;
    },
    close: () => {
      closed++;
      globalThis.clearTimeout(timer);
      finished(bytes);
    },
  };
  try {
    await assert.rejects(
      fixture(() => assert.fail('Expired source reached RPC')).uploadFile(
        source,
        { timeout: 10 }
      ),
      /timed out/
    );
    assert.equal(closed, 1);
  } finally {
    globalThis.clearTimeout(timer);
    finished(bytes);
    await pending;
  }
});

it('slices InputFile Blobs without calling the whole-file reader', async () => {
  const file = new globalThis.Blob([bytes]);
  file.arrayBuffer = () => assert.fail('Read the entire Blob');
  const result = await fixture().uploadFile(new Public.InputFile(file), {
    maxBufferSize: 0,
  });
  assert.equal(result.parts, 1);
});

it('retains names attached to direct byte uploads', async () => {
  const file = Object.assign(Uint8Array.from(bytes), { name: 'named.txt' });
  assert.equal((await fixture().uploadFile(file)).name, 'named.txt');
});

it('keeps exact size validation for an InputFile supplier returning a random-access source', async () => {
  let closed = 0;
  const source = {
    size: 3,
    read: (offset, length) => bytes.subarray(offset, offset + length),
    close: () => closed++,
  };
  const result = await fixture().uploadFile(
    new Public.InputFile(() => source),
    {
      fileSize: 3,
      maxBufferSize: 0,
    }
  );
  assert.equal(result.parts, 1);
  assert.equal(closed, 1);
});

it('documents the actual GramJS buffer-only CustomFile threshold defect', async () => {
  const file = new GramUploads.CustomFile(
    'note.txt',
    3,
    '',
    Buffer.from(bytes)
  );
  await assert.rejects(
    GramUploads.uploadFile({}, { file, workers: 1, maxBufferSize: 1 }),
    /buffer.*filePath/
  );
  const result = await fixture().gramjs.uploadFile({
    file,
    workers: 1,
    maxBufferSize: 1,
  });
  assert(result instanceof Public.Api.InputFile);
  assert.equal(result.parts, 1);
});

for (const [name, size, path, buffer] of [
  ['file', -1, '', bytes],
  ['file', 1.5, '', bytes],
  ['file', Infinity, '', bytes],
  ['file', 3, '', undefined],
  ['file', 4, '', bytes],
  ['file', 3, '', 'abc'],
  [7, 3, '', bytes],
  ['file', 3, 7, bytes],
]) {
  it(`validates owned CustomFile metadata ${String(name)}/${size}/${path}/${typeof buffer}`, () => {
    assert.equal(typeof Public.CustomFile, 'function');
    assert.throws(
      () => new Public.CustomFile(name, size, path, buffer),
      /CustomFile/
    );
  });
}

for (const [style, Vendor, uploads] of [
  ['gramjs', GramApi, GramUploads],
  ['teleproto', TeleApi, TeleUploads],
]) {
  it(`matches actual ${style} direct-upload requests and fractional progress`, async () => {
    const expectedRequests = [],
      expectedProgress = [];
    const save = async (request) => {
      expectedRequests.push(request);
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
    const sdkFile = new uploads.CustomFile(
      'note.txt',
      3,
      '',
      Buffer.from(bytes)
    );
    const expected = await uploads.uploadFile(sdk, {
      file: sdkFile,
      workers: 1,
      maxBufferSize: 32,
      onProgress: (x) => expectedProgress.push(x),
    });
    const actualRequests = [],
      progress = [];
    const actual = await fixture(async (method, params) => {
      actualRequests.push({ _: method, ...params });
      return true;
    })[style].uploadFile({
      file: sdkFile,
      workers: 1,
      maxBufferSize: 32,
      onProgress: (x) => progress.push(x),
    });
    assert.deepEqual(progress, expectedProgress);
    expected.id = actual.id;
    if (style === 'gramjs') {
      assert.equal(expected.md5Checksum, '');
      assert.equal(
        actual.md5Checksum,
        createHash('md5').update(bytes).digest('hex')
      );
      expected.md5Checksum = actual.md5Checksum;
    }
    expectedRequests[0].fileId = actual.id;
    assert.deepEqual(
      Buffer.from(gramRequest(Vendor, requestOf(actualRequests[0])).getBytes()),
      Buffer.from(expectedRequests[0].getBytes())
    );
    assert.deepEqual(
      Buffer.from(actual.getBytes()),
      Buffer.from(expected.getBytes())
    );
  });
}

for (const style of ['gramjs', 'teleproto']) {
  for (const backend of [
    'native',
    'gramjs',
    'teleproto',
    'mtcute',
    'mtproto',
  ]) {
    it(`shares ${style} direct uploads through selected ${backend} without high-level bypass`, async () => {
      const Vendor = backend === 'gramjs' ? GramApi : TeleApi;
      const calls = [];
      const call = async (method, params) => {
        const request =
          typeof method === 'string' ? { method, params } : requestOf(method);
        calls.push(objectRequest(request));
        return true;
      };
      const raw = ['gramjs', 'teleproto'].includes(backend)
        ? {
            invoke: (request) => call(request),
            uploadFile: () => assert.fail('Shared upload bypassed'),
          }
        : { call };
      const client = new Public.Anygram({
        adapters: [
          Public.createAdapter(backend, raw, {
            kind: backend === 'native' ? 'mtproto' : backend,
            Api: Vendor,
          }),
        ],
      });
      const result = await client[style].uploadFile({
        file: bytes,
        workers: 1,
      });
      assert(result instanceof Public.Api.InputFile);
      assert.equal(calls.length, 1);
      assert.equal(calls[0]._, 'upload.saveFilePart');
      assert.deepEqual(Uint8Array.from(calls[0].bytes), bytes);
    });
  }
  it(`uploads ${style} SDK records over independent encrypted native TCP`, async () => {
    const calls = [];
    const remote = await secretRpcPeer((request) => {
      calls.push(request);
      return true;
    });
    try {
      const client = new Public.Anygram({
        adapters: [
          Public.createAdapter('native', remote.client, { kind: 'mtproto' }),
        ],
      });
      const result = await client[style].uploadFile({
        file: new Public.InputFile(bytes, 'wire.txt'),
        workers: 1,
      });
      assert(result instanceof Public.Api.InputFile);
      assert.equal(result.name, 'wire.txt');
      assert.equal(calls.length, 1);
      assert.deepEqual(calls[0].bytes, bytes);
    } finally {
      await remote.close();
    }
  });
}

for (const [name, uploads] of [
  ['gramjs', GramUploads],
  ['teleproto', TeleUploads],
]) {
  it(`offers an owned CustomFile with ${name}-compatible finite fields`, () => {
    const actual = new Public.CustomFile('note.txt', 3, '', Buffer.from(bytes));
    const expected = new uploads.CustomFile(
      'note.txt',
      3,
      '',
      Buffer.from(bytes)
    );
    for (const key of ['name', 'size', 'path', 'buffer']) {
      assert.deepEqual(actual[key], expected[key]);
    }
  });
}
