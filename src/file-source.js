import { createHash } from 'node:crypto';
import { randomId } from './random.js';
import { TelegramError } from './errors.js';

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

export async function sourceOf(file) {
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
    const { open } = await import('node:fs/promises');
    const handle = await open(file, 'r');
    try {
      const { size } = await handle.stat();
      return {
        size,
        name: file.split(/[\\/]/).at(-1),
        read: async (offset, length) => {
          const buffer = Buffer.alloc(length);
          let bytesRead = 0;
          while (bytesRead < length) {
            const chunk = await handle.read(
              buffer,
              bytesRead,
              length - bytesRead,
              offset + bytesRead
            );
            if (!chunk.bytesRead) {
              throw new Error('Upload file changed or ended unexpectedly');
            }
            bytesRead += chunk.bytesRead;
          }
          return buffer;
        },
        close: () => handle.close(),
      };
    } catch (error) {
      await handle.close();
      throw error;
    }
  }
  throw new TypeError(
    'Upload requires bytes, a Blob, a local path or an InputFile'
  );
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
    const saved = await invoke(
      big ? 'upload.saveBigFilePart' : 'upload.saveFilePart',
      {
        file_id: id,
        file_part: part,
        ...(big ? { file_total_parts: parts } : {}),
        bytes,
      },
      options
    );
    if (saved !== true) {
      throw new TelegramError('Telegram did not save file part');
    }
    if (!big) {
      checksum.update(bytes);
    }
    await onProgress?.(Math.min(offset + partSize, source.size), source.size);
  }
  return {
    _: big ? 'inputFileBig' : 'inputFile',
    id,
    parts,
    name: filename ?? source.name,
    ...(!big ? { md5_checksum: checksum.digest('hex') } : {}),
  };
}
