import { createHash, randomBytes } from 'node:crypto';
import { aesIge } from './crypto.js';
import { TelegramError } from './errors.js';
import { PART_SIZE, withFileSource, uploadSource } from './file-source.js';

export function secretFileFingerprint(key, iv) {
  if (
    !(key instanceof Uint8Array) ||
    key.length !== 32 ||
    !(iv instanceof Uint8Array) ||
    iv.length !== 32
  ) {
    throw new RangeError('Encrypted files require 32-byte keys and IVs');
  }
  const digest = createHash('md5').update(key).update(iv).digest();
  return digest.readInt32LE(0) ^ digest.readInt32LE(4);
}

/** Owns mutable IGE chaining state; never changes caller-owned key or IV bytes. */
class FileCipher {
  constructor(key, iv) {
    secretFileFingerprint(key, iv);
    this.key = Buffer.from(key);
    this.iv = Buffer.from(iv);
  }

  transform(bytes, decrypt = false) {
    const output = aesIge(bytes, this.key, this.iv, decrypt);
    const cipher = decrypt ? bytes : output;
    const plain = decrypt ? output : bytes;
    this.iv.set(cipher.subarray(-16), 0);
    this.iv.set(plain.subarray(-16), 16);
    return output;
  }

  encrypt(bytes) {
    const padded = randomBytes(Math.ceil(bytes.length / 16) * 16);
    padded.set(bytes);
    try {
      return this.transform(padded);
    } finally {
      padded.fill(0);
    }
  }

  destroy() {
    this.key.fill(0);
    this.iv.fill(0);
  }
}

/** A fresh one-time key encrypts the entire file, independently of chat keys. */
export function uploadEncryptedFile(invoke, file, options = {}) {
  return withFileSource(file, options, (source, settings) =>
    uploadEncryptedSource(invoke, source, settings)
  );
}

async function uploadEncryptedSource(invoke, source, options) {
  const key = randomBytes(32);
  const iv = randomBytes(32);
  const cipher = new FileCipher(key, iv);
  try {
    const uploaded = await uploadSource(invoke, source, options, (bytes) =>
      cipher.encrypt(bytes)
    );
    const { name, ...input } = uploaded;
    return {
      file: {
        ...input,
        _:
          uploaded._ === 'inputFileBig'
            ? 'inputEncryptedFileBigUploaded'
            : 'inputEncryptedFileUploaded',
        key_fingerprint: secretFileFingerprint(key, iv),
      },
      key: Uint8Array.from(key),
      iv: Uint8Array.from(iv),
      size: source.size,
      name,
    };
  } finally {
    key.fill(0);
    iv.fill(0);
    cipher.destroy();
  }
}

function downloadDescriptor({ file, key, iv, size }, maxBytes) {
  const fingerprint = secretFileFingerprint(key, iv);
  if (
    !Number.isSafeInteger(size) ||
    size < 1 ||
    !Number.isSafeInteger(maxBytes) ||
    maxBytes < 0 ||
    size > maxBytes
  ) {
    throw new RangeError(
      'Encrypted download exceeds configured byte limit or has invalid size'
    );
  }
  const paddedSize = Math.ceil(size / 16) * 16;
  if (
    !Number.isSafeInteger(paddedSize) ||
    file?._ !== 'encryptedFile' ||
    file.key_fingerprint !== fingerprint ||
    typeof file.id !== 'bigint' ||
    typeof file.access_hash !== 'bigint' ||
    !Number.isInteger(file.dc_id) ||
    file.dc_id < 1 ||
    BigInt(file.size) !== BigInt(paddedSize)
  ) {
    throw new TypeError('Invalid encrypted file metadata or key fingerprint');
  }
  return {
    file: { ...file },
    key,
    iv,
    size,
    paddedSize,
    location: {
      _: 'inputEncryptedFileLocation',
      id: file.id,
      access_hash: file.access_hash,
    },
  };
}

/** Start at offset zero because each block depends on the preceding IGE state. */
export async function* iterDownloadEncryptedFile(
  invoke,
  descriptor,
  { maxBytes = 512 * 1024 * 1024, onProgress, ...options } = {}
) {
  const value = downloadDescriptor(descriptor, maxBytes);
  const cipher = new FileCipher(value.key, value.iv);
  options = { ...options, dc: value.file.dc_id };
  try {
    for (let offset = 0; offset < value.paddedSize; offset += PART_SIZE) {
      options.signal?.throwIfAborted();
      const result = await invoke(
        'upload.getFile',
        {
          location: value.location,
          offset: BigInt(offset),
          limit: PART_SIZE,
          cdn_supported: false,
        },
        options
      );
      const bytes = result?.bytes;
      options.signal?.throwIfAborted();
      if (
        result?._ !== 'upload.file' ||
        !(bytes instanceof Uint8Array) ||
        bytes.length !== Math.min(PART_SIZE, value.paddedSize - offset)
      ) {
        throw new TelegramError('Invalid or truncated encrypted file chunk', {
          type: 'TRUNCATED_FILE',
        });
      }
      const plain = cipher.transform(bytes, true);
      const chunk = plain.subarray(
        0,
        Math.min(plain.length, value.size - offset)
      );
      const output = Buffer.from(chunk);
      plain.fill(0);
      yield output;
      await onProgress?.(
        Math.min(offset + output.length, value.size),
        value.size
      );
    }
  } finally {
    cipher.destroy();
  }
}

export async function downloadEncryptedFile(invoke, descriptor, options = {}) {
  const chunks = [];
  for await (const chunk of iterDownloadEncryptedFile(invoke, descriptor, {
    ...options,
    maxBytes: options.maxBytes ?? 64 * 1024 * 1024,
  })) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
