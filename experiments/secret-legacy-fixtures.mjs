import { createHash } from 'node:crypto';
import { IGE } from 'telegram/crypto/IGE.js';

export const legacyKey = Buffer.from(
  Array.from({ length: 256 }, (_, index) => index)
);
const sha1 = (...parts) =>
  createHash('sha1').update(Buffer.concat(parts)).digest();

// Independently transcribed from the archived v1 specification; AES is GramJS.
export function legacyReferenceKeys(messageKey) {
  const a = sha1(messageKey, legacyKey.subarray(0, 32));
  const b = sha1(
    legacyKey.subarray(32, 48),
    messageKey,
    legacyKey.subarray(48, 64)
  );
  const c = sha1(legacyKey.subarray(64, 96), messageKey);
  const d = sha1(messageKey, legacyKey.subarray(96, 128));
  return {
    key: Buffer.concat([
      a.subarray(0, 8),
      b.subarray(8, 20),
      c.subarray(4, 16),
    ]),
    iv: Buffer.concat([
      a.subarray(8, 20),
      b.subarray(0, 8),
      c.subarray(16, 20),
      d.subarray(0, 8),
    ]),
  };
}

export function legacyReferencePacket(
  plain,
  hashedLength = 4 + plain.readInt32LE()
) {
  const messageKey = sha1(plain.subarray(0, hashedLength)).subarray(4, 20);
  const { key, iv } = legacyReferenceKeys(messageKey);
  return Buffer.concat([
    sha1(legacyKey).subarray(12, 20),
    messageKey,
    new IGE(key, iv).encryptIge(plain),
  ]);
}

export function legacyReferencePlain(packet) {
  const { key, iv } = legacyReferenceKeys(packet.subarray(8, 24));
  return new IGE(key, iv).decryptIge(packet.subarray(24));
}
