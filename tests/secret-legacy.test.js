import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { SecretChatCipher } from '../src/mtproto.js';
import {
  legacyKey as key,
  legacyReferencePacket as packetFor,
  legacyReferencePlain as plainFor,
} from '../experiments/secret-legacy-fixtures.mjs';

const cipher = (originator, options = {}) =>
  new SecretChatCipher(key, { originator, version: 1, ...options });

it('matches a fixed legacy envelope vector with an unpadded twelve-byte body', () => {
  const body = Buffer.from('Hello world!');
  const expected = Buffer.from(
    '32d1586ea457dfc8317ee034414aca537a028cd315de367d35531704eb61d83350d5bf219ad83318',
    'hex'
  );
  assert.deepEqual(cipher(true).encrypt(body), expected);
  assert.deepEqual(cipher(false).encrypt(body), expected);
  assert.deepEqual(cipher(false).decrypt(expected), body);
});

it('encrypts explicit legacy secret envelopes in both directions using independent GramJS AES', () => {
  for (const originator of [true, false]) {
    const local = cipher(originator);
    const remote = cipher(!originator);
    for (const length of [0, 4, 8, 12, 16, 128]) {
      const body = Buffer.alloc(length, 0x71);
      const packet = local.encrypt(body);
      const plain = plainFor(packet);
      assert.equal(plain.readInt32LE(), length);
      assert.deepEqual(plain.subarray(4, 4 + length), body);
      assert.ok(plain.length - 4 - length < 16);
      assert.deepEqual(packet, packetFor(plain));
      assert.deepEqual(remote.decrypt(packet), body);
    }
  }
});

it('accepts independent legacy packets with zero through twelve bytes of padding', () => {
  for (const padding of [0, 4, 8, 12]) {
    const plain = Buffer.alloc(16, 0x82);
    plain.writeInt32LE(12 - padding);
    for (const originator of [true, false]) {
      assert.deepEqual(
        cipher(originator).decrypt(packetFor(plain)),
        plain.subarray(4, 16 - padding)
      );
    }
  }
});

it('checks legacy message keys, fingerprints, ciphertext, lengths and padding bounds', () => {
  const local = cipher(false);
  const plain = Buffer.alloc(16, 0x82);
  plain.writeInt32LE(4);
  const packet = packetFor(plain);
  for (const offset of [0, 8, 24, packet.length - 1]) {
    const changed = Buffer.from(packet);
    changed[offset] ^= 1;
    assert.throws(() => local.decrypt(changed), /Invalid secret chat packet/);
  }
  for (const length of [0, 8, 24, 31, 39, packet.length - 1]) {
    assert.throws(
      () => local.decrypt(packet.subarray(0, length)),
      /Invalid secret chat packet/
    );
  }
  for (const [size, length] of [
    [-4, 16],
    [1, 16],
    [16, 16],
    [0, 32],
  ]) {
    const malformed = Buffer.alloc(length, 0x82);
    malformed.writeInt32LE(size);
    assert.throws(
      () => local.decrypt(packetFor(malformed, length)),
      /Invalid secret chat packet/
    );
  }
});

it('retains a modern default and never falls back between envelope versions', () => {
  const legacy = cipher(true);
  const modern = new SecretChatCipher(key, { originator: false });
  const body = Buffer.from('test');
  assert.throws(
    () => modern.decrypt(legacy.encrypt(body)),
    /Invalid secret chat packet/
  );
  assert.throws(
    () => legacy.decrypt(modern.encrypt(body)),
    /Invalid secret chat packet/
  );
  for (const version of [0, 3, 1.5, NaN, '1', null]) {
    assert.throws(() => cipher(true, { version }), /version/i);
  }
});

it('bounds explicit legacy payloads, owns its key and disables use after destruction', () => {
  const supplied = Uint8Array.from(key);
  const local = new SecretChatCipher(supplied, {
    originator: true,
    version: 1,
    maxBytes: 16,
  });
  supplied.fill(0);
  const body = Buffer.alloc(12, 0x71);
  assert.deepEqual(cipher(false).decrypt(local.encrypt(body)), body);
  assert.throws(() => local.encrypt(Buffer.alloc(20)), /byte limit/i);
  assert.throws(() => local.encrypt(Buffer.alloc(3)), /divisible/i);
  assert.throws(() => local.decrypt(Buffer.alloc(2048)), /byte limit/i);
  assert.throws(
    () => cipher(false, { maxBytes: 4 }).decrypt(local.encrypt(body)),
    /byte limit/i
  );
  local.destroy();
  local.destroy();
  assert.throws(() => local.encrypt(body), /destroyed/i);
  assert.throws(() => local.decrypt(Buffer.alloc(40)), /destroyed/i);
});
