import { randomBytes } from 'node:crypto';
import {
  bigEndian,
  hash,
  integer,
  modPow,
  validateDhParameters,
  validateDhPublic,
} from './crypto.js';

function restoredPrivate(state, p, g) {
  if (
    state?.version !== 1 ||
    state.p !== p.toString('base64') ||
    state.g !== g ||
    typeof state.privateValue !== 'string' ||
    state.privateValue.length !== 344
  ) {
    throw new TypeError('Invalid secret chat key-exchange state');
  }
  const bytes = Buffer.from(state.privateValue, 'base64');
  if (bytes.length !== 256 || bytes.toString('base64') !== state.privateValue) {
    bytes.fill(0);
    throw new TypeError('Invalid secret chat private exponent encoding');
  }
  return bytes;
}

function generatePrivate(prime, generator, serverRandom) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const secret = randomBytes(256);
    if (serverRandom) {
      for (let index = 0; index < 256; index++) {
        secret[index] ^= serverRandom[index];
      }
    }
    const publicValue = bigEndian(
      modPow(BigInt(generator), integer(secret), prime),
      256
    );
    try {
      validateDhPublic(prime, publicValue);
      return { secret, publicValue };
    } catch {
      secret.fill(0);
    }
  }
  throw new Error('Secret chat DH generation retry limit exceeded');
}

/** One pending DH exchange. Exported snapshots contain a private exponent. */
export class SecretChatKeyExchange {
  #p;
  #prime;
  #g;
  #private;
  #public;

  constructor({ p, g, serverRandom, state } = {}) {
    this.#prime = validateDhParameters(p, g);
    this.#p = Buffer.from(p);
    this.#g = g;
    if (
      serverRandom !== undefined &&
      (!(serverRandom instanceof Uint8Array) || serverRandom.length !== 256)
    ) {
      throw new RangeError('Server DH randomness must contain 256 bytes');
    }
    if (state !== undefined) {
      this.#private = restoredPrivate(state, this.#p, g);
      this.#public = bigEndian(
        modPow(BigInt(g), integer(this.#private), this.#prime),
        256
      );
      try {
        validateDhPublic(this.#prime, this.#public);
      } catch (error) {
        this.destroy();
        throw error;
      }
    } else {
      const generated = generatePrivate(this.#prime, g, serverRandom);
      this.#private = generated.secret;
      this.#public = generated.publicValue;
    }
  }

  get publicValue() {
    return Buffer.from(this.#public);
  }

  #assertActive() {
    if (!this.#private) {
      throw new Error('Secret chat key exchange has been destroyed');
    }
  }

  complete(peerPublic, expectedFingerprint) {
    this.#assertActive();
    let key;
    try {
      const peer = validateDhPublic(this.#prime, peerPublic);
      key = bigEndian(modPow(peer, integer(this.#private), this.#prime), 256);
      const fingerprint = hash('sha1', key).readBigInt64LE(12);
      if (
        expectedFingerprint !== undefined &&
        expectedFingerprint !== fingerprint
      ) {
        throw new Error('Secret chat key fingerprint mismatch');
      }
      return { key, fingerprint };
    } catch (error) {
      key?.fill(0);
      throw error;
    } finally {
      this.destroy();
    }
  }

  exportState() {
    this.#assertActive();
    return {
      version: 1,
      p: this.#p.toString('base64'),
      g: this.#g,
      privateValue: this.#private.toString('base64'),
    };
  }

  destroy() {
    this.#private?.fill(0);
    this.#private = undefined;
  }
}

function versionOf(config) {
  if (
    !Number.isSafeInteger(config?.version) ||
    config.version < 0 ||
    config.version > 0x7fffffff
  ) {
    throw new RangeError('Invalid secret chat DH config version');
  }
  return config.version;
}

function cachedConfig(config) {
  const version = versionOf(config);
  validateDhParameters(config.p, config.g);
  return { p: Uint8Array.from(config.p), g: config.g, version };
}

/** Refresh parameters for each initial exchange; the caller persists pending state. */
export async function createSecretChatKeyExchange(invoke, options = {}) {
  options.signal?.throwIfAborted();
  const cached = options.config && cachedConfig(options.config);
  const response = await invoke(
    'messages.getDhConfig',
    { version: cached?.version ?? 0, random_length: 256 },
    { signal: options.signal, timeout: options.timeout }
  );
  options.signal?.throwIfAborted();
  const config = response?._ === 'messages.dhConfig' ? response : cached;
  if (
    !config ||
    !['messages.dhConfig', 'messages.dhConfigNotModified'].includes(response?._)
  ) {
    throw new TypeError('Invalid secret chat DH configuration response');
  }
  const version = versionOf(config);
  if (
    !(response.random instanceof Uint8Array) ||
    response.random.length !== 256
  ) {
    throw new TypeError('Invalid secret chat server randomness');
  }
  const exchange = new SecretChatKeyExchange({
    p: config.p,
    g: config.g,
    serverRandom: response.random,
  });
  return {
    exchange,
    config: { p: Uint8Array.from(config.p), g: config.g, version },
  };
}
