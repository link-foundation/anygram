import { createCipheriv, createDecipheriv } from 'node:crypto';
import { hash } from './crypto.js';
import { TransportFraming } from './transport-framing.js';

const forbidden = new Set([
  'dddddddd',
  'eeeeeeee',
  '504f5354',
  '47455420',
  '48454144',
  '4f505449',
  '50555420',
  '44454c45',
  '54524143',
  '434f4e4e',
  '50415443',
  '16030102',
  '50567247',
]);

/** Telegram transport obfuscation; account encryption remains MTProto's job. */
export class ObfuscatedFraming extends TransportFraming {
  #encryptor;
  #decryptor;
  #header;
  constructor({
    secret,
    dc = 2,
    test = false,
    media = false,
    ...options
  } = {}) {
    const key = proxySecret(secret);
    super({
      ...options,
      mode: options.mode ?? (key?.padded ? 'padded' : 'intermediate'),
    });
    if (this.mode === 'full') {
      throw new TypeError('Obfuscated full framing is unsupported');
    }
    const init = initialization(this.random);
    init.fill(this.headerByte(), 56, 60);
    if (key) {
      init.writeInt16LE(proxyDc(dc, test, media), 60);
    }
    const reverse = Buffer.from(init).reverse();
    const derive = (bytes) => (key ? hash('sha256', bytes, key.bytes) : bytes);
    this.#encryptor = createCipheriv(
      'aes-256-ctr',
      derive(init.subarray(8, 40)),
      init.subarray(40, 56)
    );
    this.#decryptor = createDecipheriv(
      'aes-256-ctr',
      derive(reverse.subarray(8, 40)),
      reverse.subarray(40, 56)
    );
    this.#header = Buffer.concat([
      init.subarray(0, 56),
      this.#encryptor.update(init).subarray(56),
    ]);
  }
  headerByte() {
    if (this.mode === 'abridged') {
      return 0xef;
    }
    return this.mode === 'padded' ? 0xdd : 0xee;
  }
  get header() {
    return Buffer.from(this.#header);
  }
  encode(bytes) {
    return this.#encryptor.update(super.encode(bytes));
  }
  push(bytes) {
    if (this.buffer.length + bytes.byteLength > this.maxBytes * 2 + 24) {
      throw new RangeError('Obfuscated transport buffered byte limit exceeded');
    }
    return super.push(this.#decryptor.update(bytes));
  }
}

function initialization(random) {
  for (let attempt = 0; attempt < 64; attempt++) {
    const bytes = Buffer.from(random(64));
    if (bytes.length !== 64) {
      throw new RangeError('Obfuscation random source must return 64 bytes');
    }
    if (
      bytes[0] !== 0xef &&
      bytes.readUInt32LE(4) !== 0 &&
      !forbidden.has(bytes.subarray(0, 4).toString('hex'))
    ) {
      return bytes;
    }
  }
  throw new Error('Cannot generate valid obfuscation initialization');
}

function proxyDc(dc, test, media) {
  const encoded = dc + (test ? 10000 : 0);
  if (!Number.isInteger(dc) || dc < 1 || encoded > 32767) {
    throw new RangeError('Invalid MTProxy data center');
  }
  return media ? -encoded : encoded;
}

function proxySecret(value) {
  if (value === undefined) {
    return undefined;
  }
  let bytes;
  if (typeof value === 'string') {
    if (/^(?:[a-f0-9]{32}|[a-f0-9]{34})$/i.test(value)) {
      bytes = Buffer.from(value, 'hex');
    } else if (value.length <= 48 && /^[A-Za-z0-9_+/=-]+$/.test(value)) {
      bytes = Buffer.from(value, 'base64url');
      if (
        bytes.toString('base64url') !==
        value.replace(/=+$/, '').replaceAll('+', '-').replaceAll('/', '_')
      ) {
        throw new TypeError('Invalid MTProxy secret encoding');
      }
    }
  } else if (value instanceof Uint8Array) {
    bytes = Buffer.from(value);
  }
  if (!bytes || ![16, 17].includes(bytes.length)) {
    throw new TypeError(
      'MTProxy secret must contain 16 bytes or a 17-byte transport prefix'
    );
  }
  return { bytes: bytes.subarray(-16), padded: bytes.length === 17 };
}
