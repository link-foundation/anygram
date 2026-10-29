// MTProto 2.0 primitives. Protocol reference: core.telegram.org/mtproto/description.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  timingSafeEqual,
  checkPrimeSync,
} from 'node:crypto';

export const hash = (algorithm, ...parts) =>
  createHash(algorithm).update(Buffer.concat(parts)).digest();
export const equal = (left, right) =>
  left.length === right.length && timingSafeEqual(left, right);
export const xor = (left, right) =>
  Buffer.from(left.map((byte, index) => byte ^ right[index]));
export const integer = (bytes) =>
  BigInt(`0x${Buffer.from(bytes).toString('hex') || '0'}`);
export function bigEndian(number, length) {
  const hex = number.toString(16);
  const bytes = Buffer.from(
    hex.padStart(Math.ceil(hex.length / 2) * 2, '0'),
    'hex'
  );
  if (!length) {
    return bytes;
  }
  if (bytes.length > length) {
    throw new RangeError('Integer exceeds byte width');
  }
  return Buffer.concat([Buffer.alloc(length - bytes.length), bytes]);
}

export function modPow(base, exponent, modulus) {
  if (modulus <= 0n || exponent < 0n) {
    throw new RangeError('Invalid modular exponentiation');
  }
  let result = 1n;
  base %= modulus;
  while (exponent) {
    if (exponent & 1n) {
      result = (result * base) % modulus;
    }
    base = (base * base) % modulus;
    exponent >>= 1n;
  }
  return result;
}

export function aesIge(bytes, key, iv, decrypt = false) {
  if (bytes.length % 16 || key.length !== 32 || iv.length !== 32) {
    throw new RangeError('Invalid AES-IGE parameters');
  }
  const cipher = (decrypt ? createDecipheriv : createCipheriv)(
    'aes-256-ecb',
    key,
    null
  );
  cipher.setAutoPadding(false);
  const output = Buffer.alloc(bytes.length);
  let previousCipher = iv.subarray(0, 16);
  let previousPlain = iv.subarray(16);
  for (let offset = 0; offset < bytes.length; offset += 16) {
    const block = bytes.subarray(offset, offset + 16);
    const transformed = xor(
      cipher.update(xor(block, decrypt ? previousPlain : previousCipher)),
      decrypt ? previousCipher : previousPlain
    );
    output.set(transformed, offset);
    previousPlain = decrypt ? transformed : block;
    previousCipher = decrypt ? block : transformed;
  }
  cipher.final();
  return output;
}

export function deriveAes(authKey, messageKey, x) {
  const a = hash('sha256', messageKey, authKey.subarray(x, x + 36));
  const b = hash('sha256', authKey.subarray(40 + x, 76 + x), messageKey);
  return {
    key: Buffer.concat([
      a.subarray(0, 8),
      b.subarray(8, 24),
      a.subarray(24, 32),
    ]),
    iv: Buffer.concat([
      b.subarray(0, 8),
      a.subarray(8, 24),
      b.subarray(24, 32),
    ]),
  };
}

function messageKeyFor(authKey, plain, x) {
  return hash('sha256', authKey.subarray(88 + x, 120 + x), plain).subarray(
    8,
    24
  );
}

export function encryptAuthenticated(authKey, authId, plain, x) {
  const messageKey = messageKeyFor(authKey, plain, x);
  const { key, iv } = deriveAes(authKey, messageKey, x);
  return Buffer.concat([authId, messageKey, aesIge(plain, key, iv)]);
}

export function decryptAuthenticated(
  authKey,
  authId,
  packet,
  x,
  label,
  minimum = 40
) {
  if (
    !(packet instanceof Uint8Array) ||
    packet.length < minimum ||
    (packet.length - 24) % 16 ||
    !equal(packet.subarray(0, 8), authId)
  ) {
    throw new Error(`Invalid ${label} packet`);
  }
  const messageKey = packet.subarray(8, 24);
  const { key, iv } = deriveAes(authKey, messageKey, x);
  const plain = aesIge(packet.subarray(24), key, iv, true);
  if (!equal(messageKey, messageKeyFor(authKey, plain, x))) {
    throw new Error(`Invalid ${label} packet`);
  }
  return plain;
}

export function validateDh(primeBytes, generator, publicBytes) {
  const prime = integer(primeBytes);
  const g = BigInt(generator);
  const residues = {
    2: [8n, [7n]],
    3: [3n, [2n]],
    4: [1n, [0n]],
    5: [5n, [1n, 4n]],
    6: [24n, [19n, 23n]],
    7: [7n, [3n, 5n, 6n]],
  };
  const condition = residues[generator];
  if (
    primeBytes.length !== 256 ||
    prime <= 1n << 2047n ||
    !condition ||
    !condition[1].includes(prime % condition[0])
  ) {
    throw new Error('Invalid DH prime or generator');
  }
  if (
    !checkPrimeSync(primeBytes, { checks: 64 }) ||
    !checkPrimeSync(bigEndian((prime - 1n) / 2n), { checks: 64 })
  ) {
    throw new Error('DH modulus is not a safe prime');
  }
  const publicValue = integer(publicBytes);
  const bound = 1n << 1984n;
  if (
    g < 2n ||
    g > 7n ||
    publicValue <= bound ||
    publicValue >= prime - bound
  ) {
    throw new Error('Invalid DH public value');
  }
  return prime;
}

export class MtprotoCipher {
  constructor(authKey, sessionId = randomBytes(8)) {
    if (authKey.length !== 256 || sessionId.length !== 8) {
      throw new RangeError('Invalid MTProto key or session');
    }
    this.authKey = Buffer.from(authKey);
    this.authId = hash('sha1', this.authKey).subarray(-8);
    this.sessionId = Buffer.from(sessionId);
  }

  encrypt(body, { messageId, sequence = 1, salt = 0n, server = false }) {
    if (body.length % 4) {
      throw new RangeError('MTProto body must be divisible by four');
    }
    const paddingLength = 12 + ((16 - ((32 + body.length + 12) % 16)) % 16);
    const plain = Buffer.alloc(32 + body.length + paddingLength);
    plain.writeBigInt64LE(BigInt.asIntN(64, salt), 0);
    plain.set(this.sessionId, 8);
    plain.writeBigInt64LE(messageId, 16);
    plain.writeInt32LE(sequence, 24);
    plain.writeInt32LE(body.length, 28);
    plain.set(body, 32);
    plain.set(randomBytes(paddingLength), 32 + body.length);
    const x = server ? 8 : 0;
    return encryptAuthenticated(this.authKey, this.authId, plain, x);
  }

  decrypt(packet, { server = true } = {}) {
    const plain = decryptAuthenticated(
      this.authKey,
      this.authId,
      packet,
      server ? 8 : 0,
      'MTProto',
      72
    );
    const length = plain.readInt32LE(28);
    const padding = plain.length - length - 32;
    const messageId = plain.readBigInt64LE(16);
    if (
      length < 0 ||
      length % 4 ||
      padding < 12 ||
      padding > 1024 ||
      !equal(plain.subarray(8, 16), this.sessionId) ||
      Boolean(messageId & 1n) !== server
    ) {
      throw new Error('Invalid MTProto packet');
    }
    return {
      salt: plain.readBigInt64LE(0),
      messageId,
      sequence: plain.readInt32LE(24),
      body: plain.subarray(32, 32 + length),
    };
  }
}
