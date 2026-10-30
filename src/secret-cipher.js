import { randomBytes } from 'node:crypto';
import { hash, encryptAuthenticated, decryptAuthenticated } from './crypto.js';
import { encryptLegacySecret, decryptLegacySecret } from './secret-legacy.js';
import { TelegramError } from './errors.js';

/** Authenticate before a separate sequence policy accepts either wire format. */
export function decryptSecretVersions(ciphers, data) {
  const failures = [];
  for (const version of [2, 1]) {
    try {
      return { body: ciphers[version].decrypt(data), version };
    } catch (error) {
      failures.push(error);
    }
  }
  throw new TelegramError('Invalid encrypted secret chat packet', {
    type: 'SECRET_CHAT_BAD_PACKET',
    cause: new globalThis.AggregateError(failures),
  });
}

/** Secret-chat envelopes; sequencing, version negotiation and keys are separate. */
export class SecretChatCipher {
  #key;
  #fingerprint;
  #originator;
  #maxBytes;
  #version;
  #destroyed = false;

  constructor(
    key,
    { originator, maxBytes = 16 * 1024 * 1024, version = 2 } = {}
  ) {
    if (!(key instanceof Uint8Array) || key.length !== 256) {
      throw new RangeError('Secret chat key must contain 256 bytes');
    }
    if (typeof originator !== 'boolean') {
      throw new TypeError('Secret chat originator must be specified');
    }
    if (version !== 1 && version !== 2) {
      throw new RangeError('Invalid secret chat envelope version');
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
    this.#version = version;
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
    const minimum = this.#version === 1 ? 0 : 12;
    const padding = minimum + ((16 - ((4 + body.length + minimum) % 16)) % 16);
    const plain = Buffer.alloc(4 + body.length + padding);
    plain.writeInt32LE(body.length);
    plain.set(body, 4);
    plain.set(randomBytes(padding), 4 + body.length);
    if (this.#version === 1) {
      return encryptLegacySecret(this.#key, this.#fingerprint, plain);
    }
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
    const plain =
      this.#version === 1
        ? decryptLegacySecret(this.#key, this.#fingerprint, packet)
        : decryptAuthenticated(
            this.#key,
            this.#fingerprint,
            packet,
            this.#originator ? 8 : 0,
            'secret chat'
          );
    const size = plain.readInt32LE();
    const padding = plain.length - 4 - size;
    const minimum = this.#version === 1 ? 0 : 12;
    const maximum = this.#version === 1 ? 15 : 1024;
    if (size < 0 || size % 4 || padding < minimum || padding > maximum) {
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
