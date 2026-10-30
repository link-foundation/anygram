import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { IGE } from 'telegram/crypto/IGE.js';
import { aesIge } from '../src/crypto.js';
import { allocatedBufferBytes } from '../experiments/ige-allocation-probe.mjs';

for (const decrypt of [false, true]) {
  it(`bounds AES-IGE buffer copies while ${decrypt ? 'decrypting' : 'encrypting'} without changing input/key/IV`, () => {
    const plain = Buffer.alloc(65536);
    for (let index = 0; index < plain.length; index++) {
      plain[index] = index % 251;
    }
    const key = Buffer.alloc(32, 7);
    const iv = Buffer.alloc(32, 11);
    const encrypted = new IGE(key, iv).encryptIge(plain);
    const input = decrypt ? encrypted : plain;
    const saved = [input, key, iv].map((value) => Buffer.from(value));
    const measured = allocatedBufferBytes(() =>
      aesIge(input, key, iv, decrypt)
    );
    assert.deepEqual(measured.result, decrypt ? plain : encrypted);
    [input, key, iv].forEach((value, index) =>
      assert.deepEqual(value, saved[index])
    );
    assert(
      measured.bytes <= input.length * 2 + 128,
      `Buffer allocation/copy budget exceeded: ${measured.bytes} for ${input.length} input bytes`
    );
  });
}
