import { createPublicKey, randomBytes } from 'node:crypto';
import { TlCodec, TlReader, TlWriter } from './tl.js';
import {
  aesIge,
  bigEndian,
  equal,
  hash,
  integer,
  modPow,
  validateDh,
  xor,
} from './crypto.js';
import { productionKey, testKey } from './server-keys.js';

function gcd(a, b) {
  while (b) {
    [a, b] = [b, a % b];
  }
  return a;
}

/** Bounded Pollard rho for Telegram's <=64-bit pq challenge. */
export function factorize(pq) {
  if (pq <= 3n || pq > 0xffffffffffffffffn) {
    throw new RangeError('Invalid pq challenge');
  }
  if (!(pq & 1n)) {
    return [2n, pq / 2n];
  }
  let iterations = 0;
  for (let attempt = 1n; attempt <= 32n; attempt++) {
    let x = 2n;
    let y = x;
    let divisor = 1n;
    const next = (value) => (value * value + attempt) % pq;
    while (divisor === 1n && iterations++ < 1000000) {
      x = next(x);
      y = next(next(y));
      divisor = gcd(x > y ? x - y : y - x, pq);
    }
    if (divisor > 1n && divisor < pq) {
      const other = pq / divisor;
      return divisor < other ? [divisor, other] : [other, divisor];
    }
    if (iterations >= 1000000) {
      break;
    }
  }
  throw new Error('pq factorization work limit exceeded');
}

export function rsaKey(pem, codec = new TlCodec()) {
  const jwk = createPublicKey(pem).export({ format: 'jwk' });
  const n = Buffer.from(jwk.n, 'base64url');
  const e = Buffer.from(jwk.e, 'base64url');
  const writer = new TlWriter(codec);
  writer.bytes(n);
  writer.bytes(e);
  return {
    n: integer(n),
    e: integer(e),
    fingerprint: hash('sha1', writer.finish()).readBigInt64LE(12),
  };
}

export function rsaPad(data, key) {
  if (data.length > 144) {
    throw new RangeError('RSA_PAD data exceeds 144 bytes');
  }
  const padded = Buffer.concat([data, randomBytes(192 - data.length)]);
  for (let attempt = 0; attempt < 64; attempt++) {
    const temporaryKey = randomBytes(32);
    const body = Buffer.concat([
      Buffer.from(padded).reverse(),
      hash('sha256', temporaryKey, padded),
    ]);
    const encrypted = aesIge(body, temporaryKey, Buffer.alloc(32));
    const payload = Buffer.concat([
      xor(temporaryKey, hash('sha256', encrypted)),
      encrypted,
    ]);
    if (integer(payload) < key.n) {
      return bigEndian(modPow(integer(payload), key.e, key.n), 256);
    }
  }
  throw new Error('RSA_PAD retry limit exceeded');
}

function checkNonces(response, nonce, serverNonce) {
  if (
    !equal(response.nonce ?? Buffer.alloc(0), nonce) ||
    (serverNonce &&
      !equal(response.server_nonce ?? Buffer.alloc(0), serverNonce))
  ) {
    throw new Error('Authorization nonce mismatch');
  }
}

export async function createAuthKey({
  exchange,
  dc = 2,
  test = false,
  codec = new TlCodec(),
  keys = [test ? testKey : productionKey],
}) {
  const nonce = randomBytes(16);
  const response = await exchange({ _: 'req_pq_multi', nonce });
  if (response._ !== 'resPQ') {
    throw new Error('Expected resPQ');
  }
  checkNonces(response, nonce);
  const serverNonce = response.server_nonce;
  const key = keys
    .map((pem) => rsaKey(pem, codec))
    .find((key) =>
      response.server_public_key_fingerprints.includes(key.fingerprint)
    );
  if (!key) {
    throw new Error('No trusted Telegram RSA fingerprint');
  }
  const [p, q] = factorize(integer(response.pq));
  const newNonce = randomBytes(32);
  const inner = codec.encode({
    _: 'p_q_inner_data_dc',
    pq: response.pq,
    p: bigEndian(p),
    q: bigEndian(q),
    nonce,
    server_nonce: serverNonce,
    new_nonce: newNonce,
    dc: test ? dc + 10000 : dc,
  });
  const dh = await exchange({
    _: 'req_DH_params',
    nonce,
    server_nonce: serverNonce,
    p: bigEndian(p),
    q: bigEndian(q),
    public_key_fingerprint: key.fingerprint,
    encrypted_data: rsaPad(inner, key),
  });
  checkNonces(dh, nonce, serverNonce);
  if (dh._ !== 'server_DH_params_ok') {
    throw new Error('Telegram rejected DH parameters');
  }
  const a = hash('sha1', newNonce, serverNonce);
  const b = hash('sha1', serverNonce, newNonce);
  const aesKey = Buffer.concat([a, b.subarray(0, 12)]);
  const iv = Buffer.concat([
    b.subarray(12, 20),
    hash('sha1', newNonce, newNonce),
    newNonce.subarray(0, 4),
  ]);
  const plain = aesIge(dh.encrypted_answer, aesKey, iv, true);
  const reader = new TlReader(codec, plain.subarray(20));
  const answer = reader.read();
  if (
    !equal(
      plain.subarray(0, 20),
      hash('sha1', plain.subarray(20, 20 + reader.offset))
    ) ||
    plain.length - 20 - reader.offset > 15
  ) {
    throw new Error('Invalid DH answer hash');
  }
  checkNonces(answer, nonce, serverNonce);
  if (answer._ !== 'server_DH_inner_data') {
    throw new Error('Expected server DH inner data');
  }
  const prime = validateDh(answer.dh_prime, answer.g, answer.g_a);
  return finishDh({
    exchange,
    codec,
    nonce,
    serverNonce,
    newNonce,
    answer,
    prime,
    aesKey,
    iv,
  });
}

async function finishDh({
  exchange,
  codec,
  nonce,
  serverNonce,
  newNonce,
  answer,
  prime,
  aesKey,
  iv,
}) {
  let retryId = 0n;
  for (let retry = 0; retry < 3; retry++) {
    const exponent = integer(randomBytes(256));
    const publicValue = modPow(BigInt(answer.g), exponent, prime);
    const bound = 1n << 1984n;
    if (publicValue <= bound || publicValue >= prime - bound) {
      continue;
    }
    const authKey = bigEndian(
      modPow(integer(answer.g_a), exponent, prime),
      256
    );
    const data = codec.encode({
      _: 'client_DH_inner_data',
      nonce,
      server_nonce: serverNonce,
      retry_id: retryId,
      g_b: bigEndian(publicValue),
    });
    const payload = Buffer.concat([hash('sha1', data), data]);
    const encryptedData = aesIge(
      Buffer.concat([payload, randomBytes((16 - (payload.length % 16)) % 16)]),
      aesKey,
      iv
    );
    const result = await exchange({
      _: 'set_client_DH_params',
      nonce,
      server_nonce: serverNonce,
      encrypted_data: encryptedData,
    });
    checkNonces(result, nonce, serverNonce);
    const status = { dh_gen_ok: 1, dh_gen_retry: 2, dh_gen_fail: 3 }[result._];
    if (
      !status ||
      !equal(
        result[`new_nonce_hash${status}`],
        hash(
          'sha1',
          newNonce,
          Buffer.from([status]),
          hash('sha1', authKey).subarray(0, 8)
        ).subarray(4, 20)
      )
    ) {
      throw new Error('Invalid DH confirmation hash');
    }
    if (status === 1) {
      return {
        authKey,
        salt: xor(
          newNonce.subarray(0, 8),
          serverNonce.subarray(0, 8)
        ).readBigInt64LE(),
        timeOffset: answer.server_time - Math.floor(Date.now() / 1000),
      };
    }
    if (status === 3) {
      throw new Error('Telegram rejected authorization key');
    }
    retryId = hash('sha1', authKey).readBigInt64LE(0);
  }
  throw new Error('DH retry limit exceeded');
}
