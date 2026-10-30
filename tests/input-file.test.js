import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import * as anygram from '../src/index.js';
import { InputFile as ReferenceFile } from 'grammy';

const bytes = new Uint8Array([4, 5, 6]);
const success = () => new Response(JSON.stringify({ ok: true, result: true }));
function transport(options = {}) {
  const uploads = [];
  return {
    uploads,
    api: new anygram.BotApi({
      token: 'upload:fixture',
      fetch: async (url, { body }) => {
        assert(body instanceof FormData);
        const file = body.get(body.get('document').slice(9));
        uploads.push({
          bytes: new Uint8Array(await file.arrayBuffer()),
          filename: file.name,
        });
        return success();
      },
      ...options,
    }),
  };
}
const send = (api, document, options) =>
  api.callApi('sendDocument', { chat_id: 8, document }, options);

it('exports reusable InputFile bytes and Blobs with actual grammY filename/data comparisons', async () => {
  const { InputFile } = anygram;
  assert.equal(typeof InputFile, 'function');
  const { api, uploads } = transport();
  const input = new InputFile(bytes, 'frame.gif');
  await send(api, input);
  await send(api, input);
  const reference = new ReferenceFile(bytes, 'frame.gif');
  assert.deepEqual(uploads[0], {
    bytes: new Uint8Array(await reference.toRaw()),
    filename: reference.filename,
  });
  assert.deepEqual(uploads[1], uploads[0]);
  await send(api, new InputFile(new globalThis.Blob([bytes]), 'frame.png'));
  assert.equal(uploads[2].filename, 'frame.png');
  assert.deepEqual(uploads[2].bytes, bytes);
  assert.throws(() => JSON.stringify(input), /InputFile/);
});

it('uploads explicit local paths and file URLs without changing plain file IDs', async () => {
  const root = await mkdtemp(join(tmpdir(), 'anygram-input-'));
  const path = join(root, 'file with space.bin');
  try {
    await writeFile(path, bytes);
    const { api, uploads } = transport();
    await send(api, { source: path });
    await send(api, new anygram.InputFile(pathToFileURL(path), 'url.bin'));
    assert.deepEqual(uploads, [
      { bytes, filename: 'file with space.bin' },
      { bytes, filename: 'url.bin' },
    ]);
    const raw = new anygram.BotApi({
      token: 'upload:fixture',
      fetch: async (url, { body }) => {
        assert.equal(JSON.parse(body).document, path);
        return success();
      },
    });
    await send(raw, path);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('accepts byte iterators, Node streams, web streams and reusable suppliers', async () => {
  const { api, uploads } = transport();
  for (const source of [
    [bytes.subarray(0, 1), bytes.subarray(1)],
    Readable.from([bytes]),
    new globalThis.ReadableStream({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    }),
  ]) {
    await send(api, { source, filename: 'stream.bin' });
  }
  let supplied = 0;
  const factory = new anygram.InputFile(() => {
    supplied++;
    return Readable.from([bytes]);
  }, 'supplier.bin');
  await send(api, factory);
  await send(api, factory);
  assert.equal(supplied, 2);
  assert(uploads.every((entry) => entry.bytes.toString() === bytes.toString()));
  assert.equal(uploads.length, 5);
});

it('rejects reuse of a consumed InputFile stream without issuing another request', async () => {
  const { api, uploads } = transport();
  const input = new anygram.InputFile(Readable.from([bytes]), 'once.bin');
  await send(api, input);
  await assert.rejects(send(api, input), /reuse|consumed/i);
  assert.equal(uploads.length, 1);
});

it('bounds unknown-length uploads and closes iterators on overflow or invalid chunks', async () => {
  for (const chunks of [[bytes, bytes], ['not bytes']]) {
    let closed = 0;
    function* source() {
      try {
        yield* chunks;
      } finally {
        closed++;
      }
    }
    const { api, uploads } = transport({ maxUploadBytes: 4 });
    await assert.rejects(send(api, { source: source() }), /byte limit|bytes/i);
    assert.equal(closed, 1);
    assert.equal(uploads.length, 0);
  }
});

it('applies aggregate byte limits across buffered and streamed nested attachments', async () => {
  const { api, uploads } = transport({ maxUploadBytes: 5 });
  await assert.rejects(
    api.callApi('sendMediaGroup', {
      media: [
        { type: 'photo', media: bytes },
        { type: 'photo', media: { source: Readable.from([bytes]) } },
      ],
    }),
    /byte limit/i
  );
  assert.equal(uploads.length, 0);
});

it('cancels blocked upload iteration, requests cleanup and preserves the caller reason', async () => {
  const controller = new globalThis.AbortController();
  const reason = new Error('cancelled upload source');
  let entered, release;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  let closed = 0;
  const source = {
    [Symbol.asyncIterator]() {
      return this;
    },
    next() {
      entered();
      return blocked;
    },
    return() {
      closed++;
      return Promise.resolve({ done: true });
    },
  };
  const { api, uploads } = transport();
  const pending = send(api, { source }, { signal: controller.signal });
  try {
    await Promise.race([ready, pending]);
    controller.abort(reason);
    await assert.rejects(pending, (error) => error === reason);
    assert.equal(closed, 1);
    assert.equal(uploads.length, 0);
  } finally {
    release({ done: true });
    await pending.catch(() => {});
  }
});

it('enforces the request deadline while waiting for an upload supplier', async () => {
  let release;
  const blocked = new Promise((resolve) => {
    release = resolve;
  });
  const { api, uploads } = transport({ timeout: 10 });
  let watchdog;
  try {
    const pending = send(api, { source: () => blocked });
    await assert.rejects(
      Promise.race([
        pending,
        new Promise((resolve, reject) => {
          watchdog = globalThis.setTimeout(
            () => reject(new Error('Upload deadline was not enforced')),
            200
          );
        }),
      ]),
      /timed out/
    );
    assert.equal(uploads.length, 0);
  } finally {
    release(bytes);
    globalThis.clearTimeout(watchdog);
  }
});

it('checks complete request bounds before invoking any upload supplier', async () => {
  let touched = false;
  const document = {
    source: () => {
      touched = true;
      return bytes;
    },
  };
  let child = {};
  for (let index = 0; index < 70; index++) {
    child = { child };
  }
  const { api } = transport();
  await assert.rejects(
    api.callApi('sendDocument', { document, child }),
    /depth limit/
  );
  assert.equal(touched, false);
});

it('bounds recursive suppliers before transport and leaves the supplied error intact', async () => {
  const { api, uploads } = transport();
  const recursive = () => recursive;
  await assert.rejects(send(api, { source: recursive }), /supplier.*limit/i);
  const reason = new Error('source failed');
  await assert.rejects(
    send(api, {
      source: () => {
        throw reason;
      },
    }),
    (error) => error === reason
  );
  assert.equal(uploads.length, 0);
});

it('fetches explicit HTTP URL inputs without leaking the bot token into the download', async () => {
  const urls = [];
  const { api, uploads } = transport({
    fetch: async (url, options) => {
      urls.push(url);
      if (urls.length === 1) {
        assert.equal(url, 'https://files.example/frame.bin');
        assert.equal(options.headers, undefined);
        return new Response(bytes);
      }
      const file = options.body.get(options.body.get('document').slice(9));
      assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
      assert.equal(file.name, 'frame.bin');
      uploads.push(true);
      return success();
    },
  });
  await send(
    api,
    new anygram.InputFile(new globalThis.URL('https://files.example/frame.bin'))
  );
  assert.equal(urls.length, 2);
  assert.equal(uploads.length, 1);
});

it('keeps Passport error source fields as JSON rather than treating them as local paths', async () => {
  const error = {
    source: 'data',
    type: 'passport',
    field_name: 'first_name',
    data_hash: 'hash',
    message: 'invalid',
  };
  const { api } = transport({
    fetch: async (url, { body }) => {
      assert.deepEqual(JSON.parse(body).errors, [error]);
      return success();
    },
  });
  await api.callApi('setPassportDataErrors', { user_id: 8, errors: [error] });
});

it('copies reused iterator buffers so later producer writes cannot corrupt prior chunks', async () => {
  const chunk = new Uint8Array([1]);
  function* source() {
    yield chunk;
    chunk[0] = 2;
    yield chunk;
  }
  const { api, uploads } = transport();
  await send(api, { source: source() });
  assert.deepEqual(uploads[0].bytes, new Uint8Array([1, 2]));
});

it('cancels a blocked web stream and releases its lock before rejecting', async () => {
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  let cancelled = 0;
  const source = new globalThis.ReadableStream({
    pull() {
      entered();
    },
    cancel() {
      cancelled++;
    },
  });
  const controller = new globalThis.AbortController();
  const reason = new Error('web input cancelled');
  const { api, uploads } = transport();
  const pending = send(api, { source }, { signal: controller.signal });
  await ready;
  // The source can pull before the transport acquires its reader.
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  assert.equal(cancelled, 1);
  assert.equal(source.locked, false);
  assert.equal(uploads.length, 0);
});

it('rejects non-byte web stream chunks and cancels their producer', async () => {
  let cancelled = 0;
  const source = new globalThis.ReadableStream({
    start(controller) {
      controller.enqueue('text');
    },
    cancel() {
      cancelled++;
    },
  });
  const { api, uploads } = transport();
  await assert.rejects(send(api, { source }), /bytes/);
  assert.equal(cancelled, 1);
  assert.equal(source.locked, false);
  assert.equal(uploads.length, 0);
});

it('rejects oversized local files before sending and closes their owned handles', async () => {
  const root = await mkdtemp(join(tmpdir(), 'anygram-input-size-'));
  try {
    const path = join(root, 'large.bin');
    await writeFile(path, bytes);
    const { api, uploads } = transport({ maxUploadBytes: 2 });
    await assert.rejects(send(api, { source: path }), /byte limit/);
    assert.equal(uploads.length, 0);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

it('supports reusable URL-like suppliers and rejects unsupported URL protocols before fetch', async () => {
  let downloads = 0;
  const input = new anygram.InputFile({ url: 'https://files.example/x.bin' });
  const download = async () => {
    downloads++;
    return new Response(bytes);
  };
  assert.deepEqual(await input.toRaw({ fetch: download }), bytes);
  assert.deepEqual(await input.toRaw({ fetch: download }), bytes);
  assert.equal(input.filename, 'x.bin');
  assert.equal(downloads, 2);
  await assert.rejects(
    new anygram.InputFile(new globalThis.URL('ftp://files.example/x')).toRaw({
      fetch: download,
    }),
    /protocol/
  );
  assert.equal(downloads, 2);
});

it('bounds finite runs of empty web-stream chunks instead of retaining arbitrary overhead', async () => {
  let sent = 0,
    cancelled = 0;
  const empty = new Uint8Array();
  const source = new globalThis.ReadableStream({
    pull(controller) {
      if (sent++ < 100001) {
        controller.enqueue(empty);
      } else {
        controller.close();
      }
    },
    cancel() {
      cancelled++;
    },
  });
  const { api, uploads } = transport();
  await assert.rejects(send(api, { source }), /chunk limit/);
  assert.equal(cancelled, 1);
  assert(sent <= 100001);
  assert.equal(uploads.length, 0);
});

it('destroys a supplier-created Node stream that arrives after request cancellation', async () => {
  let release, entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const supplied = new Promise((resolve) => {
    release = resolve;
  });
  const controller = new globalThis.AbortController();
  const { api } = transport();
  const pending = send(
    api,
    {
      source: () => {
        entered();
        return supplied;
      },
    },
    { signal: controller.signal }
  );
  await ready;
  const reason = new Error('supplier cancelled');
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  const stream = Readable.from([bytes]);
  release(stream);
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  try {
    assert.equal(stream.destroyed, true);
  } finally {
    stream.destroy();
  }
});

it('cancels a URL response body that arrives after request cancellation', async () => {
  let release, entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const supplied = new Promise((resolve) => {
    release = resolve;
  });
  let cancelled = 0,
    calls = 0;
  const controller = new globalThis.AbortController();
  const { api } = transport({
    fetch: () => {
      calls++;
      entered();
      return supplied;
    },
  });
  const pending = send(
    api,
    new anygram.InputFile(new globalThis.URL('https://files.example/x')),
    { signal: controller.signal }
  );
  await ready;
  const reason = new Error('download cancelled');
  controller.abort(reason);
  await assert.rejects(pending, (error) => error === reason);
  const body = new globalThis.ReadableStream({
    cancel() {
      cancelled++;
    },
  });
  release(new Response(body));
  await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
  try {
    assert.equal(cancelled, 1);
    assert.equal(calls, 1);
  } finally {
    if (!cancelled) {
      await body.cancel();
    }
  }
});
