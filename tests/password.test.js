import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { getDiffieHellman, createHash, pbkdf2Sync } from 'node:crypto';
import { passwordProof } from '../src/password.js';
import { integer, bigEndian, modPow } from '../src/crypto.js';
it('generates SRP proof verified by an independent server calculation', async () => {
  const p = getDiffieHellman('modp14').getPrime();
  const prime = integer(p),
    g = 2n,
    salt1 = Buffer.from('salt one'),
    salt2 = Buffer.from('salt two');
  const h = (...parts) =>
    createHash('sha256').update(Buffer.concat(parts)).digest();
  const sh = (data, salt) => h(salt, data, salt);
  const x = integer(
    sh(
      pbkdf2Sync(
        sh(sh(Buffer.from('test password'), salt1), salt2),
        salt1,
        100000,
        64,
        'sha512'
      ),
      salt2
    )
  );
  const pad = (value) => bigEndian(value, 256);
  const k = integer(h(p, pad(g))),
    v = modPow(g, x, prime),
    b = integer(Buffer.alloc(256, 17));
  const B = (k * v + modPow(g, b, prime)) % prime;
  const result = await passwordProof(
    {
      current_algo: {
        _: 'passwordKdfAlgoSHA256SHA256PBKDF2HMACSHA512iter100000SHA256ModPow',
        p,
        g: 2,
        salt1,
        salt2,
      },
      srp_B: pad(B),
      srp_id: 7n,
    },
    'test password'
  );
  const u = integer(h(result.A, pad(B)));
  const secret = modPow(
    (integer(result.A) * modPow(v, u, prime)) % prime,
    b,
    prime
  );
  const hp = h(p),
    hg = h(pad(g));
  const combined = Buffer.from(hp.map((byte, index) => byte ^ hg[index]));
  assert.deepEqual(
    result.M1,
    h(combined, h(salt1), h(salt2), result.A, pad(B), h(pad(secret)))
  );
  assert.equal(result.srp_id, 7n);
});
it('rejects unknown password algorithms and malicious SRP parameters', async () => {
  await assert.rejects(
    passwordProof({ current_algo: { _: 'passwordKdfAlgoUnknown' } }, 'test'),
    /algorithm/
  );
});
