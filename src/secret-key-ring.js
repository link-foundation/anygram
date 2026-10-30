import { hash } from './crypto.js';
import { SecretChatCipher, decryptSecretVersions } from './secret-cipher.js';
import { secretDecodedBytes, secretLong } from './secret-handshake-state.js';
import { secretLimit } from './secret-sequence-state.js';
import { TelegramError } from './errors.js';

const indexOf = (value) => secretLimit(value, 0, 0x3fffffff, 'key sequence');
const highest = (value) =>
  secretLimit(value, -1, 0x3fffffff, 'highest key sequence');
const visualization = (key) =>
  Buffer.concat([
    hash('sha1', key).subarray(0, 16),
    hash('sha256', key).subarray(0, 20),
  ]);

function keyBytes(value) {
  if (!(value instanceof Uint8Array) || value.length !== 256) {
    throw new RangeError('Secret chat ring key must contain 256 bytes');
  }
  return value;
}

function fingerprintOf(key) {
  return hash('sha1', keyBytes(key)).readBigInt64LE(12);
}

function release(record) {
  record?.key.fill(0);
  for (const cipher of record?.ciphers ?? []) {
    cipher?.destroy();
  }
}

function keyRecord(key, originator, maxBytes) {
  const record = {
    key: Buffer.from(keyBytes(key)),
    fingerprint: fingerprintOf(key),
    ciphers: [],
  };
  try {
    for (const version of [1, 2]) {
      record.ciphers[version] = new SecretChatCipher(record.key, {
        originator,
        maxBytes,
        version,
      });
    }
    return record;
  } catch (error) {
    release(record);
    throw error;
  }
}

function restoredRecord(value, originator, maxBytes) {
  const bytes = secretDecodedBytes(value, 256, 256, 'ring key');
  try {
    return keyRecord(bytes, originator, maxBytes);
  } finally {
    bytes.fill(0);
  }
}

function badPacket(cause) {
  return new TelegramError('Invalid encrypted secret chat packet', {
    type: 'SECRET_CHAT_BAD_PACKET',
    cause,
  });
}

/** Owns two key generations and retires the older one after ordered proof. */
export class SecretChatKeyRing {
  #current;
  #previous;
  #originator;
  #maxBytes;
  #visualization;
  #highestCurrent = -1;
  #highestPrevious = -1;
  #minimum = null;
  #confirmed = false;
  #retired = null;
  #destroyed = false;

  constructor({ key, originator, maxBytes = 16 * 1024 * 1024, state } = {}) {
    this.#originator = state ? state.originator : originator;
    if (typeof this.#originator !== 'boolean') {
      throw new TypeError('Secret chat key ring requires its original role');
    }
    this.#maxBytes = secretLimit(
      maxBytes,
      4,
      16 * 1024 * 1024,
      'key ring byte limit'
    );
    try {
      if (state !== undefined) {
        this.#restore(state);
      } else {
        this.#current = keyRecord(key, this.#originator, this.#maxBytes);
        this.#visualization = visualization(this.#current.key);
      }
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  #restore(state) {
    if (state?.version !== 1 || typeof state.confirmed !== 'boolean') {
      throw new TypeError('Invalid secret chat key ring state');
    }
    this.#current = restoredRecord(state.key, this.#originator, this.#maxBytes);
    if (state.previous !== null) {
      this.#previous = restoredRecord(
        state.previous,
        this.#originator,
        this.#maxBytes
      );
    }
    this.#visualization = secretDecodedBytes(
      state.visualization,
      36,
      36,
      'visualization hash'
    );
    this.#highestCurrent = highest(state.highestCurrentSequence);
    this.#highestPrevious = highest(state.highestPreviousSequence);
    this.#minimum =
      state.minimumCurrentSequence === null
        ? null
        : indexOf(state.minimumCurrentSequence);
    this.#confirmed = state.confirmed;
    this.#retired =
      state.retiredFingerprint === null
        ? null
        : secretLong(state.retiredFingerprint, 'retired fingerprint');
    this.#validateTransition();
    if (
      this.#retired === null &&
      !this.#visualization.equals(
        visualization((this.#previous ?? this.#current).key)
      )
    ) {
      throw new Error('Secret chat original visualization hash mismatch');
    }
  }

  #validateFingerprints() {
    const prior = this.#previous?.fingerprint ?? null;
    if (
      (prior !== null && prior === this.#current.fingerprint) ||
      (this.#retired !== null &&
        [prior, this.#current.fingerprint].includes(this.#retired)) ||
      this.#confirmed !== (this.#minimum !== null)
    ) {
      throw new TypeError('Inconsistent secret chat key fingerprints or proof');
    }
  }

  #validateTransition() {
    this.#validateFingerprints();
    if (!this.#previous) {
      if (this.#highestPrevious !== -1 || this.#minimum !== null) {
        throw new TypeError('Secret chat key transition has no previous key');
      }
    } else if (this.#minimum === null) {
      if (this.#highestCurrent !== -1) {
        throw new TypeError('Observed current key lacks a sequence boundary');
      }
    } else if (
      this.#highestPrevious >= this.#minimum ||
      (this.#highestCurrent !== -1 && this.#highestCurrent < this.#minimum)
    ) {
      throw new RangeError('Inconsistent secret chat key sequence boundary');
    }
  }

  #active() {
    if (this.#destroyed) {
      throw new Error('Secret chat key ring has been destroyed');
    }
  }

  get state() {
    this.#active();
    return {
      currentFingerprint: this.#current.fingerprint,
      previousFingerprint: this.#previous?.fingerprint ?? null,
      minimumCurrentSequence: this.#minimum,
      highestCurrentSequence: this.#highestCurrent,
      highestPreviousSequence: this.#highestPrevious,
      confirmed: this.#confirmed,
      canRotate: !this.#previous,
      retiredFingerprint: this.#retired,
    };
  }

  get visualization() {
    this.#active();
    return Buffer.from(this.#visualization);
  }

  #header(data) {
    if (
      !(data instanceof Uint8Array) ||
      data.length < 40 ||
      data.length > this.#maxBytes + 1052
    ) {
      throw badPacket(
        new RangeError('Invalid secret chat key-ring packet length')
      );
    }
    return new DataView(data.buffer, data.byteOffset, 8).getBigInt64(0, true);
  }

  #recordFor(fingerprint) {
    return [this.#current, this.#previous].find(
      (entry) => entry?.fingerprint === fingerprint
    );
  }

  decrypt(data, { candidate } = {}) {
    this.#active();
    const fingerprint = this.#header(data);
    let record = this.#recordFor(fingerprint);
    let temporary;
    if (!record && candidate && fingerprintOf(candidate) === fingerprint) {
      temporary = keyRecord(candidate, this.#originator, this.#maxBytes);
      record = temporary;
    }
    if (!record) {
      throw badPacket(new Error('Unknown secret chat key fingerprint'));
    }
    try {
      return {
        ...decryptSecretVersions(record.ciphers, data),
        fingerprint,
        candidate: Boolean(temporary),
      };
    } finally {
      release(temporary);
    }
  }

  encrypt(body, version = 2) {
    this.#active();
    secretLimit(version, 1, 2, 'envelope version');
    return this.#current.ciphers[version].encrypt(body);
  }

  /** Undefined means the cached packet's key has already been retired. */
  decryptOutgoing(data, version) {
    this.#active();
    secretLimit(version, 1, 2, 'envelope version');
    const record = this.#recordFor(this.#header(data));
    if (!record) {
      return undefined;
    }
    const reader = new SecretChatCipher(record.key, {
      originator: !this.#originator,
      maxBytes: this.#maxBytes,
      version,
    });
    try {
      return reader.decrypt(data);
    } finally {
      reader.destroy();
    }
  }

  install(key, { boundary = null, confirmed = false } = {}) {
    this.#active();
    if (this.#previous) {
      throw new Error('Previous secret chat key still awaits ordered proof');
    }
    if (typeof confirmed !== 'boolean' || confirmed !== (boundary !== null)) {
      throw new TypeError('Invalid secret chat key installation proof');
    }
    if (boundary !== null && indexOf(boundary) <= this.#highestCurrent) {
      throw new RangeError(
        'Secret chat key installation boundary precedes old messages'
      );
    }
    const next = keyRecord(key, this.#originator, this.#maxBytes);
    if ([this.#current.fingerprint, this.#retired].includes(next.fingerprint)) {
      release(next);
      throw new RangeError('Repeated secret chat key fingerprint');
    }
    this.#previous = this.#current;
    this.#current = next;
    this.#highestPrevious = this.#highestCurrent;
    this.#highestCurrent = -1;
    this.#minimum = boundary;
    this.#confirmed = confirmed;
    return next.fingerprint;
  }

  /** Pass only authenticated frames accepted by sequence checks, excluding duplicates. */
  observe(fingerprint, sequence) {
    this.#active();
    const id = secretLong(fingerprint, 'observed fingerprint');
    const index = indexOf(sequence);
    if (id === this.#current.fingerprint) {
      this.#observeCurrent(index);
    } else if (id === this.#previous?.fingerprint) {
      if (this.#minimum !== null && index >= this.#minimum) {
        this.#downgrade();
      }
      this.#highestPrevious = Math.max(this.#highestPrevious, index);
    } else {
      throw new RangeError('Unrecognized authenticated secret chat key');
    }
  }

  #observeCurrent(index) {
    if (this.#previous) {
      const minimum = Math.min(this.#minimum ?? index, index);
      if (this.#highestPrevious >= minimum) {
        this.#downgrade();
      }
      this.#minimum = minimum;
      this.#confirmed = true;
    }
    this.#highestCurrent = Math.max(this.#highestCurrent, index);
  }

  #downgrade() {
    throw new TelegramError('Secret chat key sequence downgrade', {
      type: 'SECRET_CHAT_KEY_DOWNGRADE',
    });
  }

  retire(incoming) {
    this.#active();
    indexOf(incoming);
    if (!this.#previous || !this.#confirmed || incoming < this.#minimum) {
      return undefined;
    }
    const old = this.#previous;
    this.#retired = old.fingerprint;
    release(old);
    this.#previous = undefined;
    this.#highestPrevious = -1;
    this.#minimum = null;
    this.#confirmed = false;
    return this.#retired;
  }

  exportState() {
    this.#active();
    return {
      version: 1,
      originator: this.#originator,
      key: this.#current.key.toString('base64'),
      previous: this.#previous?.key.toString('base64') ?? null,
      visualization: this.#visualization.toString('base64'),
      highestCurrentSequence: this.#highestCurrent,
      highestPreviousSequence: this.#highestPrevious,
      minimumCurrentSequence: this.#minimum,
      confirmed: this.#confirmed,
      retiredFingerprint: this.#retired === null ? null : String(this.#retired),
    };
  }

  destroy() {
    release(this.#current);
    release(this.#previous);
    this.#visualization?.fill(0);
    this.#current = undefined;
    this.#previous = undefined;
    this.#destroyed = true;
  }
}
