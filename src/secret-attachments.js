import { TlCodec } from './tl.js';
import { secretDecodedBytes, secretLong } from './secret-handshake-state.js';
import { secretLimit } from './secret-sequence-state.js';
import { secretFileFingerprint } from './secret-files.js';
import { TelegramError } from './errors.js';

const codec = new TlCodec({ maxBytes: 1024, maxDepth: 8, maxVector: 8 });
const mediaTypes = new Set(
  ['Photo', 'Video', 'Audio', 'Document'].map(
    (name) => `decryptedMessageMedia${name}`
  )
);

/** Document sizes became TL long at layer 143; reject lossy older encodings. */
export function secretMessageForLayer(message, layer) {
  if (layer >= 143 || message.media?._ !== 'decryptedMessageMediaDocument') {
    return message;
  }
  const size = mediaSize(message.media);
  if (size > 0x7fffffff) {
    throw new RangeError('Secret document size exceeds negotiated layer');
  }
  return { ...message, media: { ...message.media, size } };
}

function mediaSize(media) {
  if (typeof media.size === 'bigint') {
    if (media.size < 1n || media.size > BigInt(Number.MAX_SAFE_INTEGER - 15)) {
      throw new RangeError('Invalid secret file plaintext size');
    }
    return Number(media.size);
  }
  return secretLimit(
    media.size,
    1,
    Number.MAX_SAFE_INTEGER - 15,
    'file plaintext size'
  );
}

function validateFile(file, media, incoming) {
  const size = mediaSize(media);
  const fingerprint = secretFileFingerprint(media.key, media.iv);
  secretLong(file.id, 'file ID');
  if (incoming || file._ === 'inputEncryptedFile') {
    secretLong(file.access_hash, 'file access hash');
  }
  if (incoming) {
    if (
      file._ !== 'encryptedFile' ||
      file.key_fingerprint !== fingerprint ||
      file.size !== BigInt(Math.ceil(size / 16) * 16)
    ) {
      throw new TypeError('Invalid encrypted file size or fingerprint');
    }
    secretLimit(file.dc_id, 1, 0x7fffffff, 'file data center');
  } else if (file._ !== 'inputEncryptedFile') {
    if (
      !['inputEncryptedFileUploaded', 'inputEncryptedFileBigUploaded'].includes(
        file._
      ) ||
      file.key_fingerprint !== fingerprint
    ) {
      throw new TypeError('Invalid uploaded file fingerprint');
    }
    secretLimit(file.parts, 1, 0x7fffffff, 'file part count');
    if (
      file._ === 'inputEncryptedFileUploaded' &&
      (typeof file.md5_checksum !== 'string' ||
        !/^(?:[a-f0-9]{32})?$/.test(file.md5_checksum))
    ) {
      throw new TypeError('Invalid encrypted file checksum');
    }
  }
}

/** Canonical bounded attachment bytes are retained alongside the encrypted body. */
export function encodeSecretAttachment(message, file, incoming = false) {
  try {
    const required = mediaTypes.has(message.media?._);
    if (!file || (incoming && file._ === 'encryptedFileEmpty')) {
      if (required) {
        throw new TypeError(
          'Secret media requires an encrypted file attachment'
        );
      }
      return null;
    }
    if (message._ !== 'decryptedMessage' || !required) {
      throw new TypeError('Unexpected secret file attachment');
    }
    validateFile(file, message.media, incoming);
    return Buffer.from(
      codec.encode(file, incoming ? 'EncryptedFile' : 'InputEncryptedFile')
    );
  } catch (cause) {
    throw new TelegramError(
      'Invalid secret file attachment or key fingerprint',
      {
        type: 'SECRET_CHAT_FILE_INVALID',
        cause,
      }
    );
  }
}

export function decodeSecretAttachment(bytes, incoming = false) {
  return codec.decode(bytes, incoming ? 'EncryptedFile' : 'InputEncryptedFile');
}

export function restoreSecretAttachment(message, encoded, incoming = false) {
  if (encoded === undefined || encoded === null) {
    return encodeSecretAttachment(message, undefined, incoming);
  }
  const bytes = secretDecodedBytes(encoded, 4, 1024, 'file attachment');
  try {
    const expected = encodeSecretAttachment(
      message,
      decodeSecretAttachment(bytes, incoming),
      incoming
    );
    if (!expected || Buffer.compare(bytes, expected) !== 0) {
      throw new TypeError('Noncanonical secret file attachment');
    }
    return bytes;
  } catch (error) {
    bytes.fill(0);
    throw error;
  }
}
