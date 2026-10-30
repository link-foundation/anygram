import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Anygram, createAdapter, InputFile } from '../src/index.js';
import { CustomFile as GramFile } from 'telegram/client/uploads.js';
import { CustomFile as TeleFile } from 'teleproto/client/methods/uploads.js';
import { createHash } from 'node:crypto';
import { IGE } from 'telegram/crypto/IGE.js';
import { uploadEncryptedFile } from '../src/secret-files.js';

function fixture(call) {
  return new Anygram({
    adapters: [createAdapter('native', { call }, { kind: 'mtproto' })],
  });
}

for (const style of ['canonical', 'gramjs', 'teleproto']) {
  it(`reports ${style} SDK fractional progress alongside canonical byte progress`, async () => {
    const client = fixture(async () => true);
    const sdkProgress = [],
      byteProgress = [];
    const target = style === 'canonical' ? client : client[style];
    const options = {
      partSize: 1024,
      progressCallback: (progress) => sdkProgress.push(progress),
      onProgress: (uploaded, total) => byteProgress.push([uploaded, total]),
    };
    const data = new Uint8Array(2049);
    if (style === 'canonical') {
      await target.uploadFile(data, options);
    } else {
      await target.sendFile('me', { file: data, ...options });
    }
    assert.deepEqual(sdkProgress, [0, 1 / 3, 2 / 3, 1]);
    assert.deepEqual(byteProgress, [
      [1024, 2049],
      [2048, 2049],
      [2049, 2049],
    ]);
  });
}

for (const workers of [0, -1, 1.5, 17, '2']) {
  it(`rejects invalid upload worker count ${workers} before consuming a source`, async () => {
    let consumed = 0;
    const file = new InputFile(() => {
      consumed++;
      return new Uint8Array([1]);
    });
    const client = fixture(async () =>
      assert.fail('Invalid upload reached RPC')
    );
    await assert.rejects(client.uploadFile(file, { workers }), /worker/i);
    assert.equal(consumed, 0);
  });
}

it('bounds upload workers and drains the current finite batch before propagating failure', async () => {
  const pending = [],
    calls = [];
  let active = 0,
    maximum = 0;
  const client = fixture((method, params) => {
    calls.push(params.file_part);
    active++;
    maximum = Math.max(maximum, active);
    return new Promise((resolve) =>
      pending.push(() => {
        active--;
        resolve(params.file_part !== 1);
      })
    );
  });
  const operation = client.uploadFile(new Uint8Array(5 * 1024), {
    partSize: 1024,
    workers: 2,
  });
  const rejected = assert.rejects(operation, /save file part/);
  for (let attempt = 0; attempt < 30 && pending.length < 2; attempt++) {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1));
  }
  const batch = pending.splice(0);
  for (const complete of batch) {
    complete();
  }
  // This also terminates the pre-fix sequential implementation without leaving a pending RPC.
  for (let attempt = 0; attempt < 30 && pending.length === 0; attempt++) {
    await new Promise((resolve) => globalThis.setTimeout(resolve, 1));
  }
  for (const complete of pending.splice(0)) {
    complete();
  }
  await rejected;
  assert.equal(maximum, 2);
  assert.equal(active, 0);
  assert.deepEqual(calls, [0, 1]);
});

for (const initial of [true, false]) {
  it(`honors SDK progress cancellation ${initial ? 'before consumption' : 'after one saved part'}`, async () => {
    let consumed = 0,
      calls = 0;
    const progressCallback = (progress) => {
      if (progress > 0) {
        progressCallback.isCanceled = true;
      }
    };
    progressCallback.isCanceled = initial;
    const source = new InputFile(() => {
      consumed++;
      return new Uint8Array(2048);
    }, 'source.dat');
    const client = fixture(async () => {
      calls++;
      return true;
    });
    await assert.rejects(
      client.uploadFile(source, { partSize: 1024, progressCallback }),
      /USER_CANCELED/
    );
    assert.equal(consumed, initial ? 0 : 1);
    assert.equal(calls, initial ? 0 : 1);
  });
}

for (const [name, CustomFile] of [
  ['gramjs', GramFile],
  ['teleproto', TeleFile],
]) {
  it(`uploads actual ${name} CustomFile buffers without vendor upload helpers`, async () => {
    const data = Buffer.from([1, 2, 3]);
    const file = new CustomFile('sound.ogg', data.length, '', data);
    const calls = [];
    const client = fixture(async (method, params) => {
      calls.push([method, params]);
      return method.startsWith('upload.save') ? true : { _: 'updatesTooLong' };
    });
    await client[name].sendFile('me', { file });
    assert.deepEqual(Buffer.from(calls[0][1].bytes), data);
    assert.equal(calls[1][1].media.file.name, 'sound.ogg');
    assert.equal(calls[1][1].media.mime_type, 'audio/ogg');
    assert.equal(
      calls[1][1].media.file.md5_checksum,
      createHash('md5').update(data).digest('hex')
    );
    assert.equal(file.buffer, data);
  });
}

it('bounds bytes and closes random-access upload sources on success and rejection', async () => {
  let reads = 0,
    closed = 0,
    calls = 0;
  const file = {
    name: 'notes.txt',
    size: 2049,
    read: (offset, length) => {
      reads++;
      return new Uint8Array(length).fill(offset % 256);
    },
    close: () => {
      closed++;
    },
  };
  const client = fixture(async () => {
    calls++;
    return true;
  });
  await assert.rejects(
    client.uploadFile(file, { maxBytes: 2048 }),
    /byte limit/
  );
  assert.deepEqual([reads, closed, calls], [0, 1, 0]);
  const upload = await client.uploadFile(file, { partSize: 1024, workers: 2 });
  assert.equal(upload.parts, 3);
  assert.deepEqual([reads, closed, calls], [3, 2, 3]);
});

it('retains continuous secret-file encryption when upload parts use multiple workers', async () => {
  const data = Uint8Array.from(
    { length: 3 * 1024 + 7 },
    (_, index) => index % 251
  );
  const saved = [];
  const upload = await uploadEncryptedFile(
    async (method, params) => {
      saved.push(params);
      return true;
    },
    data,
    { partSize: 1024, workers: 2 }
  );
  const encrypted = Buffer.concat(
    saved.sort((a, b) => a.file_part - b.file_part).map((part) => part.bytes)
  );
  const plain = new IGE(
    Buffer.from(upload.key),
    Buffer.from(upload.iv)
  ).decryptIge(encrypted);
  assert.deepEqual(new Uint8Array(plain.subarray(0, data.length)), data);
  assert.equal(
    upload.file.md5_checksum,
    createHash('md5').update(encrypted).digest('hex')
  );
});

it('detaches concurrent upload parts from a reused source read buffer', async () => {
  const buffer = new Uint8Array(1024);
  const parts = [];
  const source = {
    name: 'reused.bin',
    size: 3 * buffer.length,
    read: (offset, length) => buffer.fill(offset / length + 1),
  };
  const client = fixture(async (method, params) => {
    parts.push(new Uint8Array(params.bytes));
    return true;
  });
  const result = await client.uploadFile(source, {
    workers: 3,
    partSize: 1024,
  });
  assert.deepEqual(
    parts.map((part) => part[0]),
    [1, 2, 3]
  );
  assert.equal(
    result.md5_checksum,
    createHash('md5').update(Buffer.concat(parts)).digest('hex')
  );
});

it('cancels every pending finite upload batch without scheduling another part', async () => {
  const controller = new globalThis.AbortController();
  const reason = new Error('stop pending batch');
  let calls = 0,
    ready;
  const started = new Promise((resolve) => {
    ready = resolve;
  });
  const client = fixture(() => {
    if (++calls === 2) {
      ready();
    }
    return new Promise(() => {});
  });
  const operation = client.uploadFile(new Uint8Array(4096), {
    workers: 2,
    partSize: 1024,
    signal: controller.signal,
  });
  const rejected = assert.rejects(
    operation,
    (error) => error === reason || error.cause === reason
  );
  const timer = globalThis.setTimeout(() => {
    ready();
    controller.abort(reason);
  }, 100);
  try {
    await started;
    controller.abort(reason);
    await rejected;
  } finally {
    globalThis.clearTimeout(timer);
    controller.abort(reason);
  }
  assert.equal(calls, 2);
});

it('preserves both upload and source cleanup failures', async () => {
  const failure = new Error('upload failed');
  const cleanup = new Error('source close failed');
  const file = {
    name: 'notes.txt',
    size: 1,
    read: () => new Uint8Array([1]),
    close: () => {
      throw cleanup;
    },
  };
  const client = fixture(async () => {
    throw failure;
  });
  await assert.rejects(client.uploadFile(file), (error) => {
    const aggregate = error.cause ?? error;
    assert(aggregate instanceof globalThis.AggregateError);
    assert.equal(aggregate.errors[0].cause ?? aggregate.errors[0], failure);
    assert.equal(aggregate.errors[1], cleanup);
    return true;
  });
});

it('aborts a pending random-access source read and closes it before any RPC', async () => {
  const controller = new globalThis.AbortController();
  const reason = new Error('stop source read');
  let closed = 0,
    ready;
  let release;
  let finished = false;
  const started = new Promise((resolve) => {
    ready = resolve;
  });
  const source = {
    name: 'notes.txt',
    size: 1,
    read: () => {
      ready();
      return new Promise((resolve) => {
        release = resolve;
      });
    },
    close: () => {
      closed++;
    },
  };
  const client = fixture(async () => assert.fail('Aborted source reached RPC'));
  const operation = client.uploadFile(source, { signal: controller.signal });
  const rejected = assert.rejects(
    operation,
    (error) => error === reason || error.cause === reason
  );
  rejected.catch(() => {});
  const timer = globalThis.setTimeout(() => {
    finished = true;
    ready();
    release?.(new Uint8Array([1]));
  }, 100);
  try {
    await started;
    controller.abort(reason);
    await rejected;
  } finally {
    globalThis.clearTimeout(timer);
    release?.(new Uint8Array([1]));
  }
  assert.equal(closed, 1);
  assert.equal(finished, false);
});
