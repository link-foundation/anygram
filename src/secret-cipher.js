import { randomBytes } from 'node:crypto';
import { hash, encryptAuthenticated, decryptAuthenticated } from './crypto.js';

/** MTProto 2.0 secret-chat envelopes; sequencing and key exchange are separate. */
export class SecretChatCipher {
  #key;
  #fingerprint;
  #originator;
  #maxBytes;
  #destroyed = false;

  constructor(key, { originator, maxBytes = 16 * 1024 * 1024 } = {}) {
    if (!(key instanceof Uint8Array) || key.length !== 256) {
      throw new RangeError('Secret chat key must contain 256 bytes');
    }
    if (typeof originator !== 'boolean') {
      throw new TypeError('Secret chat originator must be specified');
    }
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 4 ||
      maxBytes > 16 * 1024 * 1024
    ) {
      throw new RangeError('Invalid secret chat byte limit');
    }
    this.#key = Buffer.from(key);
    this.#fingerprint = hash('sha1', this.#key).subarray(-8);
    this.#originator = originator;
    this.#maxBytes = maxBytes;
  }

  #assertActive() {
    if (this.#destroyed) {
      throw new Error('Secret chat cipher has been destroyed');
    }
  }

  encrypt(body) {
    this.#assertActive();
    if (!(body instanceof Uint8Array) || body.length % 4) {
      throw new RangeError('Secret chat body must be bytes divisible by four');
    }
    if (body.length > this.#maxBytes) {
      throw new RangeError('Secret chat body exceeds byte limit');
    }
    const padding = 12 + ((16 - ((4 + body.length + 12) % 16)) % 16);
    const plain = Buffer.alloc(4 + body.length + padding);
    plain.writeInt32LE(body.length);
    plain.set(body, 4);
    plain.set(randomBytes(padding), 4 + body.length);
    return encryptAuthenticated(
      this.#key,
      this.#fingerprint,
      plain,
      this.#originator ? 0 : 8
    );
  }

  decrypt(packet) {
    this.#assertActive();
    if (packet?.length > this.#maxBytes + 4 + 1024 + 24) {
      throw new RangeError('Secret chat packet exceeds byte limit');
    }
    const plain = decryptAuthenticated(
      this.#key,
      this.#fingerprint,
      packet,
      this.#originator ? 8 : 0,
      'secret chat'
    );
    const size = plain.readInt32LE();
    const padding = plain.length - 4 - size;
    if (size < 0 || size % 4 || padding < 12 || padding > 1024) {
      throw new Error('Invalid secret chat packet');
    }
    if (size > this.#maxBytes) {
      throw new RangeError('Secret chat body exceeds byte limit');
    }
    return plain.subarray(4, 4 + size);
  }

  destroy() {
    this.#key.fill(0);
    this.#fingerprint.fill(0);
    this.#destroyed = true;
  }
}
