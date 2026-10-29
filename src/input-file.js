import { abortable } from './cancellation.js';
import { sourceOf } from './file-source.js';
import { joinBytes } from './bytes.js';
import { readResponseBytes, validateByteLimit } from './http.js';

function filenameOf(file) {
  if (file?.url) {
    return filenameOf(new globalThis.URL(file.url));
  }
  if (file instanceof globalThis.URL) {
    return file.pathname.split('/').at(-1) || file.hostname;
  }
  return typeof file === 'string' ? file.split(/[\\/]/).at(-1) : file?.name;
}

/** Explicit upload source; plain Bot API strings remain remote IDs or URLs. */
export class InputFile {
  constructor(file, filename = filenameOf(file)) {
    this.fileData = file;
    this.filename = filename;
    this.consumed = false;
  }

  toJSON() {
    throw new TypeError('InputFile requires an upload-aware transport');
  }

  /** Internal conversion; returns finite bytes rather than an unbounded stream. */
  toRaw(options) {
    return readInputFile(this, options);
  }
}

function discardSource(source) {
  for (let depth = 0; depth < 16 && source instanceof InputFile; depth++) {
    source = source.fileData;
  }
  return source?.destroy?.() ?? source?.cancel?.() ?? source?.return?.();
}

function suppliedSource(factory, signal) {
  const pending = Promise.resolve(factory());
  pending
    .then((source) => {
      if (signal?.aborted) {
        return discardSource(source);
      }
    })
    .catch(() => {});
  return abortable(pending, signal);
}

async function resolveSource(input, signal) {
  for (let depth = 0; depth < 16; depth++) {
    signal?.throwIfAborted();
    if (input instanceof InputFile) {
      if (input.consumed) {
        throw new Error('Cannot reuse consumed InputFile data source');
      }
      const source = input.fileData;
      input.consumed = !(
        typeof source === 'function' ||
        typeof source === 'string' ||
        source instanceof Uint8Array ||
        source instanceof globalThis.Blob ||
        source instanceof globalThis.URL ||
        typeof source?.url === 'string'
      );
      input = source;
    } else if (typeof input === 'function') {
      input = await suppliedSource(input, signal);
    } else if (typeof input?.url === 'string') {
      return new globalThis.URL(input.url);
    } else {
      return input;
    }
  }
  throw new RangeError('InputFile supplier depth limit exceeded');
}

function checkSize(size, maxBytes) {
  if (size > maxBytes) {
    throw new RangeError('Bot API upload exceeds byte limit');
  }
}

async function readLocalFile(path, maxBytes, signal) {
  const source = await sourceOf(path);
  try {
    signal?.throwIfAborted();
    checkSize(source.size, maxBytes);
    const chunks = [];
    for (let offset = 0; offset < source.size; offset += 65536) {
      signal?.throwIfAborted();
      chunks.push(
        await source.read(offset, Math.min(65536, source.size - offset))
      );
    }
    signal?.throwIfAborted();
    return joinBytes(chunks, source.size);
  } finally {
    await source.close();
  }
}

async function closeIterator(input, iterator, signal, failure) {
  try {
    input.destroy?.();
    await abortable(iterator.return?.(), signal);
  } catch (error) {
    if (!failure) {
      throw error;
    }
  }
}

async function readIterator(input, maxBytes, signal) {
  const iterator =
    input?.[Symbol.asyncIterator]?.() ?? input?.[Symbol.iterator]?.();
  if (!iterator) {
    throw new TypeError(
      'InputFile requires bytes, a Blob, path, URL or byte stream'
    );
  }
  const chunks = [];
  let length = 0,
    done = false,
    failure;
  try {
    for (let count = 0; count < 100000; count++) {
      signal?.throwIfAborted();
      const item = await abortable(iterator.next(), signal);
      if (item.done) {
        done = true;
        return joinBytes(chunks, length);
      }
      if (!(item.value instanceof Uint8Array)) {
        throw new TypeError('InputFile stream must yield bytes');
      }
      length += item.value.byteLength;
      checkSize(length, maxBytes);
      if (item.value.byteLength) {
        chunks.push(item.value.slice());
      }
    }
    throw new RangeError('InputFile stream chunk limit exceeded');
  } catch (error) {
    failure = error;
    throw error;
  } finally {
    if (!done) {
      await closeIterator(input, iterator, signal, failure);
    }
  }
}

async function readUrl(source, { maxBytes, signal, fetch: fetcher }) {
  if (source.protocol === 'file:') {
    const { fileURLToPath } = await import('node:url');
    return readLocalFile(fileURLToPath(source), maxBytes, signal);
  }
  if (!['http:', 'https:'].includes(source.protocol)) {
    throw new TypeError('InputFile URL requires HTTP, HTTPS or file protocol');
  }
  const response = await abortable(fetcher(source.href, { signal }), signal);
  if (!response.ok) {
    await response.body?.cancel();
    throw new Error(`InputFile download failed with HTTP ${response.status}`);
  }
  return readResponseBytes(response, { maxBytes, signal });
}

/** One bounded reader shared by upload inputs and the multipart transport. */
export async function readInputFile(
  input,
  {
    maxBytes = 64 * 1024 * 1024,
    signal,
    fetch: fetcher = globalThis.fetch,
  } = {}
) {
  validateByteLimit(maxBytes);
  const source = await resolveSource(input, signal);
  signal?.throwIfAborted();
  if (source instanceof Uint8Array) {
    checkSize(source.byteLength, maxBytes);
    return source;
  }
  if (source instanceof globalThis.Blob) {
    checkSize(source.size, maxBytes);
    return new Uint8Array(await abortable(source.arrayBuffer(), signal));
  }
  if (typeof source === 'string') {
    return readLocalFile(source, maxBytes, signal);
  }
  if (source instanceof globalThis.URL) {
    return readUrl(source, { maxBytes, signal, fetch: fetcher });
  }
  if (typeof source?.getReader === 'function') {
    return readResponseBytes(new Response(source), { maxBytes, signal });
  }
  return readIterator(source, maxBytes, signal);
}
