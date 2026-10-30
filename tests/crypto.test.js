import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { aesIge, MtprotoCipher, modPow, validateDh } from '../src/crypto.js';

describe('MTProto cryptographic envelopes', () => {
  it('matches an independent AES-IGE implementation', async () => {
    const { IGE } = await import('telegram/crypto/IGE.js');
    const key = Buffer.alloc(32, 7);
    const iv = Buffer.alloc(32, 11);
    const plain = Buffer.alloc(64, 19);
    const expected = new IGE(key, iv).encryptIge(plain);
    assert.deepEqual(aesIge(plain, key, iv), expected);
    assert.deepEqual(aesIge(expected, key, iv, true), plain);
  });

  it('checks integrity, session and server message parity', () => {
    const cipher = new MtprotoCipher(randomBytes(256));
    const body = Buffer.from([1, 2, 3, 4]);
    const packet = cipher.encrypt(body, { messageId: 101n, server: true });
    assert.deepEqual(cipher.decrypt(packet).body, body);
    const tampered = Buffer.from(packet);
    tampered[40] ^= 1;
    assert.throws(() => cipher.decrypt(tampered), /Invalid MTProto packet/);
    const otherSession = new MtprotoCipher(cipher.authKey);
    assert.throws(() => otherSession.decrypt(packet), /Invalid MTProto packet/);
    assert.throws(
      () =>
        cipher.decrypt(cipher.encrypt(body, { messageId: 100n, server: true })),
      /Invalid MTProto packet/
    );
  });

  it('rejects undersized or invalid DH parameters before expensive work', () => {
    assert.equal(modPow(2n, 10n, 17n), 4n);
    assert.throws(
      () => validateDh(Buffer.alloc(4), 3, Buffer.alloc(4)),
      /Invalid DH/
    );
    assert.throws(
      () => aesIge(Buffer.alloc(15), Buffer.alloc(32), Buffer.alloc(32)),
      /Invalid AES/
    );
  });
});
