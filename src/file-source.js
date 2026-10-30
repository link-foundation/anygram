import { createHash } from 'node:crypto';
import { randomId } from './random.js';
import { TelegramError, throwFailures } from './errors.js';
import { InputFile, readInputFile } from './input-file.js';
import { localFileSource } from './local-file-source.js';
import { createRequestScope, validateByteLimit } from './http.js';
import { abortable } from './cancellation.js';

export const PART_SIZE = 512 * 1024;
export function validatePartSize(size) {
  if (
    !Number.isInteger(size) ||
    size < 1024 ||
    PART_SIZE % size ||
    size % 1024
  ) {
    throw new RangeError(
      'Upload part size must divide 512 KiB and be a multiple of 1 KiB'
    );
  }
}

export function uploadParts(size, partSize, maxParts) {
  const parts = Math.ceil(size / partSize);
  if (
    !Number.isSafeInteger(size) ||
    parts < 1 ||
    !Number.isInteger(maxParts) ||
    maxParts < 1 ||
    parts > maxParts
  ) {
    throw new RangeError(
      'Upload exceeds the configured part limit or is empty'
    );
  }
  return parts;
}

function ownedByteLimit({
  partSize = PART_SIZE,
  maxParts = 4000,
  maxBytes = 64 * 1024 * 1024,
}) {
  validatePartSize(partSize);
  validateByteLimit(maxBytes);
  if (!Number.isSafeInteger(maxParts) || maxParts < 1) {
    throw new RangeError('Invalid upload part limit');
  }
  return Math.min(maxBytes, partSize * maxParts);
}

export function validateUploadOptions(options) {
  const limit = ownedByteLimit(options);
  const workers = options.workers ?? 1;
  if (!Number.isInteger(workers) || workers < 1 || workers > 16) {
    throw new RangeError('Upload workers must be an integer from 1 to 16');
  }
  for (const key of ['onProgress', 'progressCallback']) {
    if (options[key] !== undefined && typeof options[key] !== 'function') {
      throw new TypeError(`Upload ${key} must be a function`);
    }
  }
  uploadCancelled(options);
  return limit;
}

function uploadCancelled({ signal, progressCallback }) {
  signal?.throwIfAborted();
  if (progressCallback?.isCanceled) {
    throw new TelegramError('USER_CANCELED', { type: 'USER_CANCELED' });
  }
}

export function validateUploadSource(file) {
  if (
    file instanceof InputFile ||
    file instanceof Uint8Array ||
    file instanceof globalThis.Blob ||
    typeof file === 'string' ||
    file?.data instanceof Uint8Array ||
    file?.buffer instanceof Uint8Array ||
    typeof file?.path === 'string' ||
    (typeof file?.read === 'function' && Number.isSafeInteger(file.size))
  ) {
    return;
  }
  throw new TypeError(
    'Media upload requires bytes, a Blob, a local path or an InputFile'
  );
}

async function recordSource(file) {
  let source;
  if (file?.buffer instanceof Uint8Array) {
    source = await sourceOf(file.buffer);
  } else if (typeof file?.path === 'string' && file.path) {
    source = await localFileSource(file.path);
  } else if (
    typeof file?.read === 'function' &&
    Number.isSafeInteger(file.size)
  ) {
    return {
      size: file.size,
      name: file.name ?? 'file',
      read: file.read.bind(file),
      close: file.close?.bind(file),
    };
  }
  if (source) {
    return sizedSource(file, source);
  }
  throw new TypeError(
    'Media upload requires bytes, a Blob, a local path or an InputFile'
  );
}

async function sizedSource(file, source) {
  if (file.size !== undefined && file.size !== source.size) {
    await source.close?.();
    throw new RangeError('Media file size does not match its source');
  }
  return { ...source, name: file.name ?? source.name };
}

export async function sourceOf(file, options = {}) {
  if (file instanceof InputFile) {
    const bytes = await readInputFile(file, {
      maxBytes: ownedByteLimit(options),
      signal: options.signal,
      fetch: options.fetch,
    });
    const source = await sourceOf(bytes);
    return { ...source, name: file.filename ?? source.name };
  }
  if (file?.data instanceof Uint8Array) {
    const result = await sourceOf(file.data);
    return { ...result, name: file.filename ?? file.name ?? result.name };
  }
  if (file instanceof Uint8Array) {
    return {
      size: file.length,
      name: 'file',
      read: (offset, length) => file.subarray(offset, offset + length),
    };
  }
  if (file instanceof globalThis.Blob) {
    return {
      size: file.size,
      name: file.name ?? 'file',
      read: async (offset, length) =>
        new Uint8Array(await file.slice(offset, offset + length).arrayBuffer()),
    };
  }
  if (typeof file === 'string') {
    return localFileSource(file);
  }
  return recordSource(file);
}

/** Own preparation, RPC and progress deadlines for explicit shared inputs. */
export async function withFileSource(file, options, upload) {
  validateUploadOptions(options);
  validateUploadSource(file);
  const scope =
    file instanceof InputFile
      ? createRequestScope(
          { signal: options.signal, timeout: options.timeout ?? 30000 },
          new TelegramError('Upload timed out', { type: 'NETWORK_ERROR' })
        )
      : undefined;
  const settings = scope ? { ...options, signal: scope.signal } : options;
  let source;
  let result;
  const failures = [];
  try {
    source = await sourceOf(file, settings);
    result = await upload(source, settings);
  } catch (error) {
    failures.push(error);
  } finally {
    scope?.dispose();
    try {
      await source?.close?.();
    } catch (error) {
      failures.push(error);
    }
  }
  throwFailures(failures, 'Upload and source cleanup failed');
  return result;
}

async function uploadBatch(invoke, source, state, options, transform) {
  const payloads = [];
  const end = Math.min(state.part + (options.workers ?? 1), state.parts);
  for (; state.part < end; state.part++) {
    uploadCancelled(options);
    const offset = state.part * state.partSize;
    const length = Math.min(state.partSize, source.size - offset);
    const plain = await abortable(source.read(offset, length), options.signal);
    uploadCancelled(options);
    if (!(plain instanceof Uint8Array) || plain.length !== length) {
      throw new TelegramError(
        'Upload source returned an invalid or truncated part'
      );
    }
    // A random-access source may reuse its read buffer for the next part.
    const bytes = new Uint8Array(transform(plain));
    if (!state.big) {
      state.checksum.update(bytes);
    }
    payloads.push({
      file_id: state.id,
      file_part: state.part,
      ...(state.big ? { file_total_parts: state.parts } : {}),
      bytes,
    });
  }
  const results = await Promise.allSettled(
    payloads.map(async (params) => {
      uploadCancelled(options);
      return await abortable(
        invoke(
          state.big ? 'upload.saveBigFilePart' : 'upload.saveFilePart',
          params,
          options
        ),
        options.signal
      );
    })
  );
  for (const result of results) {
    if (result.status === 'rejected') {
      throw result.reason;
    }
    if (result.value !== true) {
      throw new TelegramError('Telegram did not save file part');
    }
    uploadCancelled(options);
    state.saved++;
    await abortable(
      options.onProgress?.(
        Math.min(state.saved * state.partSize, source.size),
        source.size
      ),
      options.signal
    );
    await abortable(
      options.progressCallback?.(state.saved / state.parts),
      options.signal
    );
    uploadCancelled(options);
  }
}

/** Finite batches bound memory to at most sixteen 512 KiB parts. */
export async function uploadSource(
  invoke,
  source,
  options,
  transform = (bytes) => bytes
) {
  const limit = validateUploadOptions(options);
  if (source.size > limit) {
    throw new RangeError('Upload exceeds configured byte limit');
  }
  const { partSize = PART_SIZE, maxParts = 4000, filename } = options;
  const parts = uploadParts(source.size, partSize, maxParts);
  const id = randomId();
  const big = source.size > 10 * 1024 * 1024;
  const checksum = createHash('md5');
  const state = { part: 0, saved: 0, parts, partSize, id, big, checksum };
  await abortable(options.progressCallback?.(0), options.signal);
  while (state.part < parts) {
    await uploadBatch(invoke, source, state, options, transform);
  }
  return {
    _: big ? 'inputFileBig' : 'inputFile',
    id,
    parts,
    name: filename ?? source.name,
    ...(!big ? { md5_checksum: checksum.digest('hex') } : {}),
  };
}
