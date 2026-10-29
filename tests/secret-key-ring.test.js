import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as api from '../src/mtproto.js';

const key = (value) => new Uint8Array(256).fill(value);
const create = (options = {}) =>
  new api.SecretChatKeyRing({ key: key(1), originator: true, ...options });
const fingerprint = (value) =>
  createHash('sha1').update(value).digest().readBigInt64LE(12);
const portable = (value) => JSON.parse(JSON.stringify(value));
const packet = (value, version = 2) => {
  const cipher = new api.SecretChatCipher(key(value), {
    originator: false,
    version,
  });
  try {
    return cipher.encrypt(new Uint8Array([1, 2, 3, 4]));
  } finally {
    cipher.destroy();
  }
};

it('keeps the previous key until authenticated new-key proof and preceding incoming gaps close', () => {
  const ring = create();
  const old = fingerprint(key(1));
  const next = fingerprint(key(2));
  ring.observe(old, 1);
  ring.install(key(2));
  assert.equal(ring.retire(10), undefined);
  assert.deepEqual(ring.decrypt(packet(1)).body, Buffer.from([1, 2, 3, 4]));
  const incoming = ring.decrypt(packet(2));
  assert.equal(incoming.fingerprint, next);
  assert.equal(incoming.candidate, false);
  ring.observe(next, 5);
  assert.equal(ring.retire(4), undefined);
  ring.observe(old, 4);
  assert.equal(ring.retire(5), old);
  assert.equal(ring.state.previousFingerprint, null);
  assert.throws(
    () => ring.decrypt(packet(1)),
    (error) => error.type === 'SECRET_CHAT_BAD_PACKET'
  );
  assert.equal(ring.state.currentFingerprint, next);
});

it('authenticates a candidate without switching keys and rejects authenticated key downgrades atomically', () => {
  const ring = create();
  const before = ring.exportState();
  const incoming = ring.decrypt(packet(2), { candidate: key(2) });
  assert.equal(incoming.candidate, true);
  assert.deepEqual(ring.exportState(), before);
  ring.observe(fingerprint(key(1)), 8);
  assert.throws(
    () => ring.install(key(2), { boundary: 5, confirmed: true }),
    /boundary/
  );
  ring.install(key(2));
  const pending = ring.exportState();
  assert.throws(
    () => ring.observe(fingerprint(key(2)), 7),
    (error) => error.type === 'SECRET_CHAT_KEY_DOWNGRADE'
  );
  assert.deepEqual(ring.exportState(), pending);
  ring.observe(fingerprint(key(2)), 9);
  const modern = ring.exportState();
  assert.throws(() => ring.observe(fingerprint(key(1)), 10), /downgrade/);
  assert.deepEqual(ring.exportState(), modern);
});

it('restores bounded key transitions and preserves original visualization hashes after retirement', () => {
  const ring = create();
  const visualization = Buffer.concat([
    createHash('sha1').update(key(1)).digest().subarray(0, 16),
    createHash('sha256').update(key(1)).digest().subarray(0, 20),
  ]);
  ring.observe(fingerprint(key(1)), 1);
  ring.install(key(2), { boundary: 2, confirmed: true });
  const state = portable(ring.exportState());
  const restored = new api.SecretChatKeyRing({ state });
  assert.deepEqual(restored.exportState(), state);
  assert.deepEqual(restored.visualization, visualization);
  assert.equal(restored.retire(2), fingerprint(key(1)));
  const retired = portable(restored.exportState());
  assert.equal(retired.previous, null);
  assert.deepEqual(
    new api.SecretChatKeyRing({ state: retired }).visualization,
    visualization
  );
  assert.throws(() => restored.install(key(1)), /fingerprint/);
});

it('authenticates both envelope versions, bounds candidate packets and leaves failed authentication unchanged', () => {
  const ring = create({ maxBytes: 4 });
  const before = ring.exportState();
  for (const version of [1, 2]) {
    const incoming = ring.decrypt(packet(1, version));
    assert.equal(incoming.version, version);
    const next = packet(2, version);
    assert.equal(ring.decrypt(next, { candidate: key(2) }).candidate, true);
    next[next.length - 1] ^= 1;
    assert.throws(
      () => ring.decrypt(next, { candidate: key(2) }),
      (error) => error.type === 'SECRET_CHAT_BAD_PACKET'
    );
  }
  for (const invalid of [null, [], new Uint8Array(39), new Uint8Array(1060)]) {
    assert.throws(() => ring.decrypt(invalid), /packet/);
  }
  assert.throws(() => ring.decrypt(packet(2), { candidate: key(3) }), /packet/);
  assert.throws(
    () => ring.decrypt(packet(2), { candidate: new Uint8Array(255) }),
    /256 bytes/
  );
  assert.deepEqual(ring.exportState(), before);
  assert.throws(() => ring.encrypt(new Uint8Array(8)), /byte limit/);
  assert.throws(() => ring.encrypt(new Uint8Array(4), 3), /version/);
});

it('validates cached outgoing packets while their keys exist and reports retired ciphertext without recovering its key', () => {
  const ring = create();
  const body = new Uint8Array([8, 7, 6, 5]);
  const packets = [1, 2].map((version) => ring.encrypt(body, version));
  ring.install(key(2), { boundary: 0, confirmed: true });
  for (const version of [1, 2]) {
    assert.deepEqual(
      ring.decryptOutgoing(packets[version - 1], version),
      Buffer.from(body)
    );
  }
  const corrupt = Buffer.from(packets[1]);
  corrupt[24] ^= 1;
  assert.throws(() => ring.decryptOutgoing(corrupt, 2));
  ring.retire(0);
  for (const version of [1, 2]) {
    assert.equal(
      ring.decryptOutgoing(packets[version - 1], version),
      undefined
    );
  }
  assert.equal(
    JSON.stringify(ring.exportState()).includes(
      Buffer.from(key(1)).toString('base64')
    ),
    false
  );
});

it('rejects malformed portable keys, proofs and sequence boundaries before exposing a key ring', () => {
  const ring = create();
  ring.observe(fingerprint(key(1)), 3);
  ring.install(key(2));
  const pending = ring.exportState();
  const invalid = [
    { version: 2 },
    { originator: 1 },
    { key: '' },
    { previous: undefined },
    { previous: pending.key },
    { key: `${pending.key}\n` },
    { visualization: '' },
    { visualization: Buffer.alloc(36).toString('base64') },
    { highestCurrentSequence: 0 },
    { highestPreviousSequence: -2 },
    { highestPreviousSequence: 0x40000000 },
    { highestCurrentSequence: NaN },
    { minimumCurrentSequence: 3, confirmed: true },
    { minimumCurrentSequence: 4, confirmed: false },
    { minimumCurrentSequence: null, confirmed: true },
    { retiredFingerprint: String(fingerprint(key(1))) },
    { retiredFingerprint: String(fingerprint(key(2))) },
    { retiredFingerprint: '-0' },
  ];
  for (const change of invalid) {
    assert.throws(
      () => new api.SecretChatKeyRing({ state: { ...pending, ...change } }),
      JSON.stringify(change)
    );
  }
  ring.observe(fingerprint(key(2)), 5);
  const confirmed = ring.exportState();
  for (const change of [
    { highestCurrentSequence: 4, minimumCurrentSequence: 5 },
    { previous: null },
    { minimumCurrentSequence: 3 },
  ]) {
    assert.throws(
      () => new api.SecretChatKeyRing({ state: { ...confirmed, ...change } })
    );
  }
  ring.retire(5);
  assert.throws(
    () =>
      new api.SecretChatKeyRing({
        state: { ...ring.exportState(), highestPreviousSequence: 0 },
      })
  );
});

it('owns key/hash bytes, bounds overlapping transitions and remains usable after rejected operations', () => {
  const owned = key(1);
  const ring = create({ key: owned });
  const original = ring.exportState();
  owned.fill(9);
  ring.visualization.fill(0);
  for (const options of [
    { boundary: 1 },
    { confirmed: true },
    { boundary: -1, confirmed: true },
    { boundary: 0x40000000, confirmed: true },
    { confirmed: 1 },
  ]) {
    assert.throws(() => ring.install(key(2), options));
    assert.deepEqual(ring.exportState(), original);
  }
  for (const value of [-1, 0.5, 0x40000000, Infinity]) {
    assert.throws(() => ring.observe(fingerprint(key(1)), value));
    assert.throws(() => ring.retire(value));
  }
  assert.throws(() => ring.observe(0n, 0), /Unrecognized/);
  assert.throws(() => ring.install(key(1)), /fingerprint/);
  ring.install(key(2));
  assert.throws(() => ring.install(key(3)), /previous secret chat key/i);
  ring.observe(fingerprint(key(2)), 0);
  ring.retire(1);
  ring.install(key(3), { boundary: 1, confirmed: true });
  ring.retire(1);
  const restored = new api.SecretChatKeyRing({
    state: portable(ring.exportState()),
  });
  assert.equal(restored.state.currentFingerprint, fingerprint(key(3)));
  assert.equal(
    restored.visualization.toString('base64'),
    original.visualization
  );
  assert.equal(restored.exportState().previous, null);
  ring.destroy();
  ring.destroy();
  for (const action of [
    () => ring.state,
    () => ring.visualization,
    () => ring.exportState(),
    () => ring.encrypt(new Uint8Array(4)),
    () => ring.decrypt(packet(1)),
    () => ring.decryptOutgoing(packet(1), 2),
    () => ring.install(key(4)),
    () => ring.observe(fingerprint(key(1)), 0),
    () => ring.retire(0),
  ]) {
    assert.throws(action, /destroyed/);
  }
});
