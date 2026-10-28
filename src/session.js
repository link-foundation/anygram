/** Portable secrets-bearing session. Persistence is always explicitly requested. */
export class Session {
  #state;
  constructor(value = {}) {
    if (value instanceof Session) {
      value = value.options();
    }
    if (typeof value === 'string') {
      value = value ? decode(value) : {};
    }
    const { dc = 2, authKey, salt = 0n, timeOffset = 0, test = false } = value;
    validateSession({ dc, authKey, salt, timeOffset });
    this.#state = {
      dc,
      authKey: authKey && Buffer.from(authKey),
      salt: BigInt(salt),
      timeOffset,
      test: Boolean(test),
    };
  }
  options() {
    return {
      ...this.#state,
      authKey: this.#state.authKey && Buffer.from(this.#state.authKey),
    };
  }
  save() {
    return `anygram:1:${Buffer.from(
      JSON.stringify({
        ...this.#state,
        authKey: this.#state.authKey?.toString('base64'),
        salt: String(this.#state.salt),
      })
    ).toString('base64url')}`;
  }
  toJSON() {
    return '[Anygram session]';
  }
  static fromClient(client) {
    return new Session({
      dc: client.dc,
      authKey: client.cipher?.authKey,
      salt: client.salt,
      timeOffset: client.timeOffset,
      test: client.test,
    });
  }
}
function decode(value) {
  if (value.length > 8192) {
    throw new RangeError('Session exceeds size limit');
  }
  if (value.startsWith('anygram:1:')) {
    const data = JSON.parse(
      Buffer.from(value.slice(10), 'base64url').toString()
    );
    return {
      ...data,
      authKey: data.authKey && Buffer.from(data.authKey, 'base64'),
    };
  }
  if (value.startsWith('1')) {
    const bytes = Buffer.from(value.slice(1), 'base64');
    // GramJS/teleproto store an address length. Telethon stores an IPv4/IPv6
    // address directly; the payload lengths distinguish the formats.
    let offset;
    if (bytes.length === 263 || bytes.length === 275) {
      offset = bytes.length - 256;
    } else {
      offset = 3 + bytes.readUInt16BE(1) + 2;
    }
    if (offset < 5 || offset + 256 !== bytes.length) {
      throw new TypeError('Invalid legacy session');
    }
    return { dc: bytes[0], authKey: bytes.subarray(offset) };
  }
  throw new TypeError('Unsupported session version');
}

function validateSession({ dc, authKey, salt, timeOffset }) {
  if (!Number.isInteger(dc) || dc < 1 || dc > 5) {
    throw new RangeError('Invalid session data center');
  }
  if (authKey && (!(authKey instanceof Uint8Array) || authKey.length !== 256)) {
    throw new RangeError('Invalid session authorization key');
  }
  if (!Number.isFinite(timeOffset)) {
    throw new RangeError('Invalid session time offset');
  }
  if (BigInt(salt) < -(1n << 63n) || BigInt(salt) >= 1n << 63n) {
    throw new RangeError('Invalid session salt');
  }
}
