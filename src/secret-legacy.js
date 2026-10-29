import { aesIge, equal, hash } from './crypto.js';

// Deprecated MTProto 1.0, used only when explicitly selected for negotiation.
// Secret chats use x=0 in both directions in this version.
function deriveLegacy(key, messageKey) {
  const a = hash('sha1', messageKey, key.subarray(0, 32));
  const b = hash(
    'sha1',
    key.subarray(32, 48),
    messageKey,
    key.subarray(48, 64)
  );
  const c = hash('sha1', key.subarray(64, 96), messageKey);
  const d = hash('sha1', messageKey, key.subarray(96, 128));
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

function legacyMessageKey(plain) {
  const length = plain.readInt32LE();
  const padding = plain.length - 4 - length;
  if (length < 0 || length % 4 || padding < 0 || padding > 15) {
    throw new Error('Invalid secret chat packet');
  }
  return hash('sha1', plain.subarray(0, 4 + length)).subarray(4, 20);
}

export function encryptLegacySecret(key, fingerprint, plain) {
  const messageKey = legacyMessageKey(plain);
  const aes = deriveLegacy(key, messageKey);
  return Buffer.concat([
    fingerprint,
    messageKey,
    aesIge(plain, aes.key, aes.iv),
  ]);
}

export function decryptLegacySecret(key, fingerprint, packet) {
  if (
    !(packet instanceof Uint8Array) ||
    packet.length < 40 ||
    (packet.length - 24) % 16 ||
    !equal(packet.subarray(0, 8), fingerprint)
  ) {
    throw new Error('Invalid secret chat packet');
  }
  const messageKey = packet.subarray(8, 24);
  const aes = deriveLegacy(key, messageKey);
  const plain = aesIge(packet.subarray(24), aes.key, aes.iv, true);
  try {
    if (!equal(messageKey, legacyMessageKey(plain))) {
      throw new Error('Invalid secret chat packet');
    }
    return plain;
  } catch (error) {
    plain.fill(0);
    throw error;
  }
}
