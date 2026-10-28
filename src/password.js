import { pbkdf2, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { hash, integer, bigEndian, modPow, validateDh, xor } from './crypto.js';
const derive = promisify(pbkdf2);
const algorithm =
  'passwordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow';

export async function passwordHash(algo, password) {
  if (algo?._ !== algorithm) {
    throw new TypeError('Unsupported Telegram password algorithm');
  }
  const salted = (data, salt) => hash('sha256', salt, data, salt);
  const first = salted(
    salted(Buffer.from(password, 'utf8'), algo.salt1),
    algo.salt2
  );
  return salted(
    await derive(first, algo.salt1, 100000, 64, 'sha512'),
    algo.salt2
  );
}

/** SRP-6a proof, following core.telegram.org/api/srp. */
export async function passwordProof(parameters, password) {
  const algo = parameters.current_algo;
  if (algo?._ !== algorithm) {
    throw new TypeError('Unsupported Telegram password algorithm');
  }
  const p = integer(algo.p),
    B = integer(parameters.srp_B);
  if (B <= 0n || B >= p) {
    throw new RangeError('Invalid SRP server value');
  }
  validateDh(algo.p, algo.g, bigEndian(p / 2n, 256));
  const g = BigInt(algo.g),
    pad = (value) => bigEndian(value, 256);
  const k = integer(hash('sha256', algo.p, pad(g)));
  const x = integer(await passwordHash(algo, password));
  const base = (B - ((k * modPow(g, x, p)) % p) + p) % p;
  const bound = 1n << 1984n;
  if (base <= bound || base >= p - bound) {
    throw new RangeError('Invalid SRP public value');
  }
  for (let attempt = 0; attempt < 64; attempt++) {
    const a = integer(randomBytes(256)),
      A = modPow(g, a, p);
    if (A <= bound || A >= p - bound) {
      continue;
    }
    const u = integer(hash('sha256', pad(A), pad(B)));
    if (!u) {
      continue;
    }
    const secret = modPow(base, a + u * x, p);
    return {
      _: 'inputCheckPasswordSRP',
      srp_id: parameters.srp_id,
      A: pad(A),
      M1: hash(
        'sha256',
        xor(hash('sha256', algo.p), hash('sha256', pad(g))),
        hash('sha256', algo.salt1),
        hash('sha256', algo.salt2),
        pad(A),
        pad(B),
        hash('sha256', pad(secret))
      ),
    };
  }
  throw new Error('SRP generation work limit exceeded');
}
