import { createHash } from 'node:crypto';
import { randomId } from './random.js';
import { TelegramError } from './errors.js';
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
  throw new TypeError(
    'Upload requires bytes, a Blob, a local path or an InputFile'
  );
}

/** Own preparation, RPC and progress deadlines for explicit shared inputs. */
export async function withFileSource(file, options, upload) {
  options.signal?.throwIfAborted();
  const scope =
    file instanceof InputFile
      ? createRequestScope(
          { signal: options.signal, timeout: options.timeout ?? 30000 },
          new TelegramError('Upload timed out', { type: 'NETWORK_ERROR' })
        )
      : undefined;
  const settings = scope ? { ...options, signal: scope.signal } : options;
  let source;
  try {
    source = await sourceOf(file, settings);
    return await upload(source, settings);
  } finally {
    scope?.dispose();
    await source?.close?.();
  }
}

/** Sequential bounded upload, shared by cloud and independently encrypted files. */
export async function uploadSource(
  invoke,
  source,
  { partSize = PART_SIZE, maxParts = 4000, filename, onProgress, ...options },
  transform = (bytes) => bytes
) {
  validatePartSize(partSize);
  const parts = uploadParts(source.size, partSize, maxParts);
  const id = randomId();
  const big = source.size > 10 * 1024 * 1024;
  const checksum = createHash('md5');
  for (let part = 0; part < parts; part++) {
    options.signal?.throwIfAborted();
    const offset = part * partSize;
    const plain = await source.read(
      offset,
      Math.min(partSize, source.size - offset)
    );
    options.signal?.throwIfAborted();
    const bytes = transform(plain);
    const saved = await abortable(
      invoke(
        big ? 'upload.saveBigFilePart' : 'upload.saveFilePart',
        {
          file_id: id,
          file_part: part,
          ...(big ? { file_total_parts: parts } : {}),
          bytes,
        },
        options
      ),
      options.signal
    );
    if (saved !== true) {
      throw new TelegramError('Telegram did not save file part');
    }
    if (!big) {
      checksum.update(bytes);
    }
    await abortable(
      onProgress?.(Math.min(offset + partSize, source.size), source.size),
      options.signal
    );
  }
  return {
    _: big ? 'inputFileBig' : 'inputFile',
    id,
    parts,
    name: filename ?? source.name,
    ...(!big ? { md5_checksum: checksum.digest('hex') } : {}),
  };
}
