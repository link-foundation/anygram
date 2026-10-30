import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { IGE } from 'telegram/crypto/IGE.js';
import * as protocol from '../src/mtproto.js';

const key = Buffer.from(Array.from({ length: 256 }, (_, index) => index));
const digest = (...parts) =>
  createHash('sha256').update(Buffer.concat(parts)).digest();

// Independent formula from Telegram's end-to-end specification; AES uses GramJS.
function referenceKeys(messageKey, x) {
  const a = digest(messageKey, key.subarray(x, x + 36));
  const b = digest(key.subarray(40 + x, 76 + x), messageKey);
  return {
    aes: Buffer.concat([a.subarray(0, 8), b.subarray(8, 24), a.subarray(24)]),
    iv: Buffer.concat([b.subarray(0, 8), a.subarray(8, 24), b.subarray(24)]),
  };
}

function referencePacket(plain, x = 0) {
  const messageKey = digest(key.subarray(88 + x, 120 + x), plain).subarray(
    8,
    24
  );
  const { aes, iv } = referenceKeys(messageKey, x);
  return Buffer.concat([
    createHash('sha1').update(key).digest().subarray(-8),
    messageKey,
    new IGE(aes, iv).encryptIge(plain),
  ]);
}

it('encrypts secret-chat envelopes in both directions using the independent GramJS AES oracle', () => {
  for (const originator of [true, false]) {
    const cipher = new protocol.SecretChatCipher(key, { originator });
    const body = Buffer.from('12345678');
    const packet = cipher.encrypt(body);
    const x = originator ? 0 : 8;
    const messageKey = packet.subarray(8, 24);
    const { aes, iv } = referenceKeys(messageKey, x);
    const plain = new IGE(aes, iv).decryptIge(packet.subarray(24));
    assert.equal(plain.readInt32LE(), body.length);
    assert.deepEqual(plain.subarray(4, 4 + body.length), body);
    assert.ok(plain.length - 4 - body.length >= 12);
    assert.ok(plain.length - 4 - body.length <= 1024);
    assert.deepEqual(packet, referencePacket(plain, x));
    const recipient = new protocol.SecretChatCipher(key, {
      originator: !originator,
    });
    assert.deepEqual(recipient.decrypt(packet), body);
    assert.throws(() => cipher.decrypt(packet), /Invalid secret chat packet/);
  }
});

it('accepts independently encrypted secret-chat bodies with every supported padding boundary', () => {
  const cipher = new protocol.SecretChatCipher(key, { originator: false });
  for (const padding of [12, 16, 28, 1008, 1020, 1024]) {
    const size = (16 - ((4 + padding) % 16)) % 16;
    const plain = Buffer.alloc(4 + size + padding, 0x71);
    plain.writeInt32LE(size);
    assert.deepEqual(
      cipher.decrypt(referencePacket(plain)),
      plain.subarray(4, 4 + size)
    );
  }
});

it('rejects authenticated malformed secret-chat lengths and padding', () => {
  const cipher = new protocol.SecretChatCipher(key, { originator: false });
  for (const [size, length] of [
    [-4, 32],
    [1, 32],
    [20, 32],
    [40, 32],
    [12, 1056],
  ]) {
    const plain = Buffer.alloc(length, 0x31);
    plain.writeInt32LE(size);
    assert.throws(
      () => cipher.decrypt(referencePacket(plain)),
      /Invalid secret chat packet/
    );
  }
});

it('checks secret-chat fingerprints, ciphertext, message keys and truncation', () => {
  const cipher = new protocol.SecretChatCipher(key, { originator: false });
  const plain = Buffer.alloc(32);
  plain.writeInt32LE(4);
  const packet = referencePacket(plain);
  for (const offset of [0, 8, 24, packet.length - 1]) {
    const changed = Buffer.from(packet);
    changed[offset] ^= 1;
    assert.throws(() => cipher.decrypt(changed), /Invalid secret chat packet/);
  }
  for (const length of [0, 8, 24, 31, 39, packet.length - 1]) {
    assert.throws(
      () => cipher.decrypt(packet.subarray(0, length)),
      /Invalid secret chat packet/
    );
  }
});

it('validates secret-chat controls and bounds payloads before encryption and decryption', () => {
  for (const size of [0, 255, 257]) {
    assert.throws(
      () =>
        new protocol.SecretChatCipher(Buffer.alloc(size), { originator: true }),
      /key/i
    );
  }
  for (const options of [
    {},
    { originator: 1 },
    { originator: true, maxBytes: NaN },
    { originator: false, maxBytes: 0 },
  ]) {
    assert.throws(
      () => new protocol.SecretChatCipher(key, options),
      /originator|limit/i
    );
  }
  const cipher = new protocol.SecretChatCipher(key, {
    originator: false,
    maxBytes: 16,
  });
  assert.throws(() => cipher.encrypt(Buffer.alloc(20)), /limit/i);
  assert.throws(() => cipher.encrypt(Buffer.alloc(3)), /divisible/i);
  assert.throws(() => cipher.decrypt(Buffer.alloc(4096)), /limit/i);
  const plain = Buffer.alloc(48);
  plain.writeInt32LE(20);
  assert.throws(() => cipher.decrypt(referencePacket(plain)), /limit/i);
});

it('copies caller-owned secret keys and erases its own material when destroyed', () => {
  const source = Buffer.from(key);
  const sender = new protocol.SecretChatCipher(source, { originator: true });
  source.fill(0);
  const recipient = new protocol.SecretChatCipher(key, { originator: false });
  const body = Buffer.from('1234');
  assert.deepEqual(recipient.decrypt(sender.encrypt(body)), body);
  sender.destroy();
  sender.destroy();
  assert.throws(() => sender.encrypt(body), /destroyed/i);
  assert.throws(
    () => sender.decrypt(referencePacket(Buffer.alloc(32))),
    /destroyed/i
  );
  assert.deepEqual(source, Buffer.alloc(256));
  assert.equal(key[255], 255);
});
