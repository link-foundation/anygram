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
    const {
      dc = 2,
      authKey,
      salt = 0n,
      timeOffset = 0,
      test = false,
      serverAddress,
      port,
    } = value;
    validateSession({ dc, authKey, salt, timeOffset });
    this.#state = {
      dc,
      authKey: authKey && Buffer.from(authKey),
      salt: BigInt(salt),
      timeOffset,
      test: Boolean(test),
      serverAddress,
      port,
    };
  }
  options() {
    return {
      ...this.#state,
      authKey: this.#state.authKey && Buffer.from(this.#state.authKey),
    };
  }
  save(format = 'anygram') {
    if (format === 'gramjs') {
      return encodeGramjs(this.#state);
    }
    if (format !== 'anygram') {
      throw new TypeError('Unsupported session format');
    }
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
    let offset, serverAddress, port;
    if (bytes.length === 263 || bytes.length === 275) {
      offset = bytes.length - 256;
      serverAddress =
        bytes.length === 263
          ? [...bytes.subarray(1, 5)].join('.')
          : Array.from({ length: 8 }, (_, i) =>
              bytes.readUInt16BE(1 + i * 2).toString(16)
            ).join(':');
      port = bytes.readUInt16BE(offset - 2);
    } else {
      offset = 3 + bytes.readUInt16BE(1) + 2;
      serverAddress = bytes.subarray(3, offset - 2).toString();
      port = bytes.readUInt16BE(offset - 2);
    }
    if (offset < 5 || offset + 256 !== bytes.length) {
      throw new TypeError('Invalid legacy session');
    }
    return {
      dc: bytes[0],
      authKey: bytes.subarray(offset),
      serverAddress,
      port,
    };
  }
  throw new TypeError('Unsupported session version');
}

function encodeGramjs({ dc, authKey, serverAddress, port = 443, test }) {
  if (!authKey) {
    return '';
  }
  // Official bootstrap endpoints, not a substitute for help.getConfig:
  // https://github.com/telegramdesktop/tdesktop/blob/f985723b552b30fe1c17d377d57f44e61a15a8c4/Telegram/SourceFiles/mtproto/mtproto_dc_options.cpp
  const addresses = test
    ? ['149.154.175.10', '149.154.167.40', '149.154.175.117']
    : [
        '149.154.175.50',
        '149.154.167.51',
        '149.154.175.100',
        '149.154.167.91',
        '149.154.171.5',
      ];
  serverAddress ??= addresses[dc - 1];
  if (
    !serverAddress ||
    Buffer.byteLength(serverAddress) > 100 ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 32767
  ) {
    throw new RangeError('Invalid GramJS session endpoint');
  }
  const address = Buffer.from(serverAddress);
  const header = Buffer.alloc(3);
  header[0] = dc;
  header.writeUInt16BE(address.length, 1);
  const encodedPort = Buffer.alloc(2);
  encodedPort.writeUInt16BE(port);
  return `1${Buffer.concat([header, address, encodedPort, authKey]).toString('base64')}`;
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
