import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as api from '../src/mtproto.js';
import { telegramDhPrime as p } from '../experiments/secret-dh-fixtures.mjs';

const create = (options = {}) =>
  new api.SecretChatRekey({ p, g: 3, ...options });
const portable = (value) => JSON.parse(JSON.stringify(value));

it('completes bilateral re-keying with the commit under the old key and noop under the new key', () => {
  const alice = create();
  const bob = create();
  const request = alice.request(-5n);
  assert.equal(request._, 'decryptedMessageActionRequestKey');
  const accept = bob.receive(request);
  assert.equal(accept.install, undefined);
  assert.equal(accept.actions[0]._, 'decryptedMessageActionAcceptKey');
  assert.equal(bob.state.phase, 'accepted');
  const commit = alice.receive(accept.actions[0]);
  assert.equal(commit.installBeforeActions, false);
  assert.equal(commit.actions[0]._, 'decryptedMessageActionCommitKey');
  assert.equal(alice.state.phase, 'committed');
  const finish = bob.receive(commit.actions[0]);
  assert.equal(finish.installBeforeActions, true);
  assert.equal(finish.actions[0]._, 'decryptedMessageActionNoop');
  assert.deepEqual(finish.install, commit.install);
  assert.equal(bob.state.phase, 'idle');
  assert.deepEqual(alice.confirm(finish.install.fingerprint).actions, []);
  assert.equal(alice.state.phase, 'idle');
});

it('resolves simultaneous requests using signed exchange IDs and clears equal collisions silently', () => {
  const alice = create();
  const bob = create();
  const small = alice.request(-1n);
  const large = bob.request(1n);
  assert.deepEqual(bob.receive(small).actions, []);
  assert.equal(bob.state.exchangeId, 1n);
  const accept = alice.receive(large);
  assert.equal(alice.state.exchangeId, 1n);
  const commit = bob.receive(accept.actions[0]);
  assert.deepEqual(alice.receive(commit.actions[0]).install, commit.install);
  const first = create();
  const second = create();
  const one = first.request(-(1n << 63n));
  const two = second.request(-(1n << 63n));
  assert.deepEqual(first.receive(two).actions, []);
  assert.deepEqual(second.receive(one).actions, []);
  assert.equal(first.state.phase, 'idle');
  assert.equal(second.state.phase, 'idle');
});

it('restores pending exponents and accepted keys through protected JSON snapshots', () => {
  const original = create();
  const request = original.request(123n);
  const snapshot = portable(original.exportState());
  const alice = new api.SecretChatRekey({ state: snapshot });
  snapshot.exchange.privateValue = '';
  assert.deepEqual(alice.pendingAction(), request);
  const bob = create();
  const accept = bob.receive(request);
  const restored = new api.SecretChatRekey({
    state: portable(bob.exportState()),
  });
  assert.deepEqual(restored.pendingAction(), accept.actions[0]);
  const commit = alice.receive(restored.pendingAction());
  const finished = restored.receive(commit.actions[0]);
  assert.deepEqual(finished.install, commit.install);
  const pending = new api.SecretChatRekey({
    state: portable(alice.exportState()),
  });
  assert.deepEqual(pending.pendingAction(), commit.actions[0]);
  pending.confirm(finished.install.fingerprint);
  assert.equal(pending.state.phase, 'idle');
});

it('requires rotation after 100 uses or an encrypting key reaches one week, without overlapping exchanges', () => {
  let now = 1000;
  const chat = create({ now: () => now });
  chat.record({ received: 100 });
  assert.equal(chat.shouldRotate(), false);
  now += 7 * 24 * 60 * 60;
  assert.equal(chat.shouldRotate(), false);
  chat.record({ sent: 1 });
  assert.equal(chat.shouldRotate(), true);
  chat.request(1n);
  assert.equal(chat.shouldRotate(), false);
  assert.throws(() => chat.request(2n), /in progress/);
  chat.abort();
  assert.equal(chat.shouldRotate(), true);
  const age = create({ now: () => now });
  age.record({ sent: 1 });
  now += 7 * 24 * 60 * 60 - 1;
  assert.equal(age.shouldRotate(), false);
  now++;
  assert.equal(age.shouldRotate(), true);
  assert.equal(age.shouldRotate(now - 8 * 24 * 60 * 60), false);
  const volume = create();
  volume.record({ sent: 50, received: 50 });
  assert.equal(volume.shouldRotate(), false);
  volume.record({ received: 1 });
  assert.equal(volume.shouldRotate(), true);
});

it('honors permitted peer aborts and never rolls back an accepted or committed local action', () => {
  const alice = create();
  const bob = create();
  const accept = bob.receive(alice.request(1n));
  const accepted = bob.exportState();
  assert.throws(() => bob.abort(), /Cannot abort/);
  assert.deepEqual(bob.exportState(), accepted);
  bob.receive(alice.abort());
  assert.equal(alice.state.phase, 'idle');
  assert.equal(bob.state.phase, 'idle');
  assert.equal(bob.abort(), undefined);
  assert.deepEqual(
    bob.receive({ _: 'decryptedMessageActionAbortKey', exchange_id: 2n })
      .actions,
    []
  );
  const first = create();
  const second = create();
  const commit = first.receive(second.receive(first.request(3n)).actions[0]);
  assert.throws(() => first.abort(), /Cannot abort/);
  assert.equal(first.state.phase, 'committed');
  assert.throws(
    () =>
      first.receive({ _: 'decryptedMessageActionAbortKey', exchange_id: 3n }),
    (error) => error.type === 'SECRET_CHAT_REKEY_INVALID'
  );
  assert.throws(() => first.exportState(), /destroyed/);
  assert.equal(accept.actions[0].exchange_id, 1n);
  assert.equal(commit.actions[0].exchange_id, 3n);
});

it('rejects conflicting exchanges without disturbing an accepted candidate', () => {
  const alice = create();
  const bob = create();
  bob.receive(alice.request(5n));
  const before = bob.exportState();
  const other = create().request(9n);
  for (const action of [
    other,
    { _: 'decryptedMessageActionAcceptKey', exchange_id: 9n },
  ]) {
    assert.deepEqual(bob.receive(action).actions, [
      { _: 'decryptedMessageActionAbortKey', exchange_id: 9n },
    ]);
    assert.deepEqual(bob.exportState(), before);
  }
  assert.deepEqual(bob.receive(alice.pendingAction()).actions, []);
  assert.deepEqual(
    bob.receive({ _: 'decryptedMessageActionCommitKey', exchange_id: 9n })
      .actions,
    []
  );
  assert.deepEqual(bob.exportState(), before);
});

it('destroys pending private material after invalid peer public values or fingerprints', () => {
  for (const value of [
    new Uint8Array(),
    new Uint8Array([1]),
    new Uint8Array(257),
  ]) {
    const receiver = create();
    assert.throws(
      () =>
        receiver.receive({
          _: 'decryptedMessageActionRequestKey',
          exchange_id: 1n,
          g_a: value,
        }),
      (error) => error.type === 'SECRET_CHAT_REKEY_INVALID'
    );
    assert.throws(() => receiver.exportState(), /destroyed/);
  }
  const alice = create();
  const bob = create();
  const accept = bob.receive(alice.request(1n)).actions[0];
  assert.throws(
    () =>
      alice.receive({
        ...accept,
        key_fingerprint: accept.key_fingerprint ^ 1n,
      }),
    /re-keying message/
  );
  assert.throws(() => alice.pendingAction(), /destroyed/);
  const first = create();
  const second = create();
  const commit = first.receive(second.receive(first.request(2n)).actions[0])
    .actions[0];
  assert.throws(
    () =>
      second.receive({
        ...commit,
        key_fingerprint: commit.key_fingerprint ^ 1n,
      }),
    /re-keying message/
  );
  assert.throws(() => second.exportState(), /destroyed/);
});

it('installs an accepted candidate on authenticated new-key proof when the commit is missing', () => {
  let now = 1000;
  const alice = create({ now: () => now });
  const bob = create({ now: () => now });
  alice.record({ sent: 101 });
  bob.record({ received: 101 });
  const accept = bob.receive(alice.request(1n));
  const before = bob.exportState();
  assert.deepEqual(
    bob.confirm(accept.actions[0].key_fingerprint ^ 1n).actions,
    []
  );
  assert.deepEqual(bob.exportState(), before);
  now += 10;
  const commit = alice.receive(accept.actions[0]);
  const candidate = bob.candidate;
  assert.deepEqual(candidate, commit.install);
  candidate.key.fill(0);
  assert.deepEqual(bob.candidate, commit.install);
  const finish = bob.confirm(commit.install.fingerprint);
  assert.deepEqual(finish.install, commit.install);
  assert.equal(finish.installBeforeActions, true);
  assert.equal(bob.candidate, undefined);
  assert.equal(bob.state.createdAt, now);
  assert.equal(bob.state.received, 0);
  alice.confirm(finish.install.fingerprint);
  assert.equal(alice.state.sent, 0);
  assert.equal(alice.shouldRotate(), false);
  assert.deepEqual(bob.receive(commit.actions[0]).actions, []);
});

it('rejects malformed, inconsistent or unbounded protected re-keying snapshots', () => {
  const alice = create();
  const bob = create();
  bob.receive(alice.request(1n));
  const accepted = portable(bob.exportState());
  const changes = [
    (s) => {
      s.version = 2;
    },
    (s) => {
      s.phase = 'unknown';
    },
    (s) => {
      s.phase = 'idle';
    },
    (s) => {
      s.createdAt = -1;
    },
    (s) => {
      s.sent = 0x80000000;
    },
    (s) => {
      delete s.received;
    },
    (s) => {
      s.p = 'A'.repeat(4000);
    },
    (s) => {
      s.g = 1;
    },
    (s) => {
      s.exchangeId = '01';
    },
    (s) => {
      s.exchangeId = String(1n << 63n);
    },
    (s) => {
      s.key = null;
    },
    (s) => {
      s.fingerprint = String(BigInt(s.fingerprint) ^ 1n);
    },
    (s) => {
      s.exchange = alice.exportState().exchange;
    },
    (s) => {
      s.publicValue = Buffer.alloc(256).toString('base64');
    },
  ];
  for (const change of changes) {
    const state = portable(accepted);
    change(state);
    assert.throws(() => new api.SecretChatRekey({ state }));
  }
  const requesting = portable(alice.exportState());
  const wrongPublic = portable(requesting);
  wrongPublic.publicValue = accepted.publicValue;
  assert.throws(
    () => new api.SecretChatRekey({ state: wrongPublic }),
    /mismatch/
  );
  const idle = create().exportState();
  assert.deepEqual(
    new api.SecretChatRekey({ state: idle }).exportState(),
    idle
  );
});

it('copies caller data and validates usage updates atomically before mutation', () => {
  const input = Uint8Array.from(p);
  const chat = create({ p: input });
  input.fill(0);
  const request = chat.request(1n);
  const expected = chat.pendingAction();
  request.g_a.fill(0);
  assert.deepEqual(chat.pendingAction(), expected);
  const snapshot = chat.exportState();
  assert.throws(() => chat.record({ sent: 1, received: -1 }), /count/);
  assert.deepEqual(chat.exportState(), snapshot);
  chat.record({ sent: 0x7fffffff });
  const maximum = chat.exportState();
  assert.throws(() => chat.record({ sent: 1 }), /count/);
  assert.deepEqual(chat.exportState(), maximum);
  assert.throws(() => chat.shouldRotate(Infinity), /time/);
  chat.destroy();
  chat.destroy();
  assert.throws(() => chat.state, /destroyed/);
  assert.throws(() => chat.receive({}), /destroyed/);
  assert.throws(() => chat.request(), /destroyed/);
});

it('serializes PFS services through real sequence frames and enforces the old/new envelope boundary', () => {
  const alice = create();
  const bob = create();
  const sequences = [true, false].map(
    (originator) => new api.SecretChatSequence({ originator })
  );
  const codec = new api.SecretChatCodec();
  const originalKey = new Uint8Array(256).fill(42);
  let id = 0n;
  const encrypt = (action, key, index) => {
    const frame = sequences[index].create({
      _: 'decryptedMessageService',
      random_id: ++id,
      action,
    });
    const cipher = new api.SecretChatCipher(key, { originator: index === 0 });
    try {
      return cipher.encrypt(codec.encode(frame));
    } finally {
      cipher.destroy();
    }
  };
  const decrypt = (packet, key, index) => {
    const cipher = new api.SecretChatCipher(key, { originator: index === 0 });
    try {
      return codec.decode(cipher.decrypt(packet));
    } finally {
      cipher.destroy();
    }
  };
  const delivered = (packet, key, index) =>
    sequences[index].receive(decrypt(packet, key, index)).messages[0].message
      .action;
  const request = encrypt(alice.request(1n), originalKey, 0);
  const accept = bob.receive(delivered(request, originalKey, 1));
  const response = encrypt(accept.actions[0], originalKey, 1);
  const commit = alice.receive(delivered(response, originalKey, 0));
  const confirmation = encrypt(commit.actions[0], originalKey, 0);
  assert.throws(
    () => decrypt(confirmation, commit.install.key, 1),
    /packet|fingerprint/i
  );
  const finish = bob.receive(delivered(confirmation, originalKey, 1));
  assert.deepEqual(finish.install, commit.install);
  const noop = encrypt(finish.actions[0], finish.install.key, 1);
  assert.throws(() => decrypt(noop, originalKey, 0), /packet|fingerprint/i);
  assert.equal(
    delivered(noop, commit.install.key, 0)._,
    'decryptedMessageActionNoop'
  );
  alice.confirm(finish.install.fingerprint);
  assert.equal(alice.state.phase, 'idle');
  assert.equal(bob.state.phase, 'idle');
});
