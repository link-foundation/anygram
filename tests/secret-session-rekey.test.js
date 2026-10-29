import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as api from '../src/mtproto.js';
import { telegramDhPrime as p } from '../experiments/secret-dh-fixtures.mjs';

const original = () => new Uint8Array(256).fill(7);
const peer = { _: 'inputEncryptedChat', chat_id: 123, access_hash: 456n };
const save = () => {};
const portable = (value) => JSON.parse(JSON.stringify(value));
const create = (originator, extra = {}) =>
  new api.SecretChatSession({
    key: original(),
    originator,
    peer,
    dh: { p, g: 3 },
    ...extra,
  });
const message = (id) => ({
  _: 'decryptedMessage',
  random_id: BigInt(id),
  ttl: 0,
  message: `message ${id}`,
});
const client = () => {
  let id = 0n;
  return {
    callWithReceipt: async () => ({
      messageId: (id += 4n),
      dc: 2,
      value: { _: 'messages.sentEncryptedMessage', date: 1 },
    }),
  };
};
async function transfer(sender, receiver) {
  const packets = sender.pending();
  for (const entry of packets) {
    await receiver.receive(entry.request.data, { save });
  }
  await sender.flush(client(), { save });
  return packets;
}

it('rotates durable sessions bilaterally and restores exact ciphertext after old keys are erased', async () => {
  const alice = create(true);
  const bob = create(false);
  await alice.rotateKey(7n, { save });
  assert.equal(alice.state.rekey.phase, 'requesting');
  await transfer(alice, bob);
  assert.equal(bob.state.rekey.phase, 'accepted');
  await transfer(bob, alice);
  assert.equal(alice.state.rekey.phase, 'committed');
  assert.notEqual(
    alice.exportState().key,
    Buffer.from(original()).toString('base64')
  );
  const commit = alice.pending()[0].request.data;
  const oldReader = new api.SecretChatCipher(original(), {
    originator: false,
    version: 2,
  });
  assert.equal(
    new api.SecretChatCodec().decode(oldReader.decrypt(commit)).message.action
      ._,
    'decryptedMessageActionCommitKey'
  );
  oldReader.destroy();
  await transfer(alice, bob);
  assert.equal(bob.state.keys.previousFingerprint, null);
  await transfer(bob, alice);
  for (const session of [alice, bob]) {
    assert.equal(session.state.rekey.phase, 'idle');
    assert.equal(session.state.keys.previousFingerprint, null);
    const state = portable(session.exportState());
    assert.equal(state.keyState.previous, null);
    assert.equal(
      JSON.stringify(state).includes(
        Buffer.from(original()).toString('base64')
      ),
      false
    );
    const restored = new api.SecretChatSession({ state });
    assert.deepEqual(restored.exportState(), state);
    assert.deepEqual(restored.pending(), session.pending());
  }
  await alice.queue(message(1), { save });
  const incoming = await bob.receive(alice.pending()[0].request.data, { save });
  assert.equal(incoming.messages.at(-1).message.message, 'message 1');
});

it('starts compulsory rotation by usage and key age and rolls back failed rotation persistence', async () => {
  let now = 1000;
  const session = create(true, { now: () => now });
  await session.queue(message(1), { save });
  now += 7 * 24 * 60 * 60;
  const before = session.exportState();
  await assert.rejects(
    session.notify({
      save: () => {
        throw new Error('disk failed');
      },
    }),
    /disk failed/
  );
  assert.deepEqual(session.exportState(), before);
  await session.notify({ save });
  assert.equal(session.state.rekey.phase, 'requesting');
  const busy = session.exportState();
  await assert.rejects(session.rotateKey(9n, { save }), /in progress/);
  assert.deepEqual(session.exportState(), busy);
  const volume = create(true);
  for (let id = 1; id <= 100; id++) {
    await volume.queue(message(id), { save });
  }
  assert.equal(volume.state.rekey.phase, 'requesting');
  assert.equal(volume.state.sequence.outgoing, 102);
  const manual = new api.SecretChatSession({
    key: original(),
    peer,
    originator: true,
  });
  await assert.rejects(manual.rotateKey(1n, { save }), /DH parameters/);
});

it('authenticates a new-key packet before a missing commit while retaining the old key until the gap closes', async () => {
  const alice = create(true);
  let bob = create(false);
  await alice.rotateKey(5n, { save });
  await transfer(alice, bob);
  await transfer(bob, alice);
  const commit = alice.pending()[0].request.data;
  await alice.queue(message(11), { save });
  const future = alice.pending()[1].request.data;
  const output = await bob.receive(future, { save });
  assert.deepEqual(output.messages, []);
  assert.ok(output.resend);
  assert.equal(bob.state.rekey.phase, 'idle');
  assert.notEqual(bob.state.keys.previousFingerprint, null);
  await transfer(bob, alice);
  assert.equal(alice.state.keys.previousFingerprint, null);
  assert.deepEqual(alice.pending()[0].request.data, commit);
  bob = new api.SecretChatSession({ state: portable(bob.exportState()) });
  const recovered = await bob.receive(commit, { save });
  assert.equal(recovered.messages.at(-1).message.message, 'message 11');
  assert.equal(bob.state.keys.previousFingerprint, null);
  await assert.rejects(
    bob.receive(commit, { save }),
    (error) => error.type === 'SECRET_CHAT_BAD_PACKET'
  );
  assert.equal(bob.state.phase, 'active');
});

it('rolls back every saved PFS transition and restarts pending exponents, candidates and committed keys', async () => {
  let alice = create(true);
  let bob = create(false);
  const rejectSave = async (receiver, packet) => {
    const before = receiver.exportState();
    await assert.rejects(
      receiver.receive(packet, {
        save: () => {
          throw new Error('disk failed');
        },
      }),
      /disk failed/
    );
    assert.deepEqual(receiver.exportState(), before);
    await receiver.receive(packet, { save });
    return new api.SecretChatSession({
      state: portable(receiver.exportState()),
    });
  };
  await alice.rotateKey(10n, { save });
  alice = new api.SecretChatSession({ state: portable(alice.exportState()) });
  await bob.receive(alice.pending()[0].request.data, { save });
  bob = await rejectSave(bob, alice.pending()[1].request.data);
  await alice.flush(client(), { save });
  await alice.receive(bob.pending()[0].request.data, { save });
  alice = await rejectSave(alice, bob.pending()[1].request.data);
  assert.equal(alice.state.rekey.sent, 0);
  await bob.flush(client(), { save });
  bob = await rejectSave(bob, alice.pending()[0].request.data);
  await alice.flush(client(), { save });
  alice = await rejectSave(alice, bob.pending()[0].request.data);
  assert.equal(alice.state.rekey.phase, 'idle');
  assert.equal(bob.state.rekey.phase, 'idle');
  assert.equal(alice.exportState().key, bob.exportState().key);
});

it('resolves simultaneous durable exchanges for either initiating role and rejects overlapping key generations', async () => {
  const alice = create(true);
  const bob = create(false);
  await alice.rotateKey(-1n, { save });
  await bob.rotateKey(1n, { save });
  await transfer(alice, bob);
  assert.equal(bob.state.rekey.exchangeId, 1n);
  await transfer(bob, alice);
  assert.equal(alice.state.rekey.phase, 'accepted');
  await transfer(alice, bob);
  assert.equal(bob.state.rekey.phase, 'committed');
  const before = bob.exportState();
  await assert.rejects(bob.rotateKey(2n, { save }), /previous.*key/i);
  assert.deepEqual(bob.exportState(), before);
  await transfer(bob, alice);
  await transfer(alice, bob);
  assert.equal(alice.state.rekey.phase, 'idle');
  assert.equal(bob.state.rekey.phase, 'idle');
  assert.equal(alice.exportState().key, bob.exportState().key);
});

it('rejects corrupt retired ciphertext, PFS metadata and pending key mappings on restore', async () => {
  const alice = create(true);
  const bob = create(false);
  await alice.rotateKey(1n, { save });
  await transfer(alice, bob);
  await transfer(bob, alice);
  await transfer(alice, bob);
  await transfer(bob, alice);
  const state = portable(alice.exportState());
  for (const change of [
    (s) => {
      s.outbox[0].digest = '';
    },
    (s) => {
      const bytes = Buffer.from(s.outbox[0].data, 'base64');
      bytes[24] ^= 1;
      s.outbox[0].data = bytes.toString('base64');
    },
    (s) => {
      delete s.rekey;
    },
    (s) => {
      s.keyState.originator = false;
    },
    (s) => {
      s.keyState = null;
    },
    (s) => {
      s.keyState.previous = s.key;
    },
    (s) => {
      s.incomingKeys = [[0, '1']];
    },
    (s) => {
      s.rekey.phase = 'committed';
    },
  ]) {
    const broken = portable(state);
    change(broken);
    assert.throws(() => new api.SecretChatSession({ state: broken }));
  }
});

it('bounds restored key observations by accepted sequence frames and validates every queued key mapping', async () => {
  const alice = create(true);
  const bob = create(false);
  await alice.rotateKey(5n, { save });
  await transfer(alice, bob);
  await transfer(bob, alice);
  await alice.queue(message(1), { save });
  await bob.receive(alice.pending()[1].request.data, { save });
  const state = portable(bob.exportState());
  for (const change of [
    (s) => {
      s.keyState.highestCurrentSequence = 99;
    },
    (s) => {
      s.incomingKeys = [];
    },
    (s) => {
      s.incomingKeys[0][1] = s.keyState.retiredFingerprint ?? '0';
    },
    (s) => {
      s.incomingKeys[0][0] += 2;
    },
  ]) {
    const broken = portable(state);
    change(broken);
    assert.throws(() => new api.SecretChatSession({ state: broken }));
  }
});

it('migrates earlier single-key snapshots with their accepted sequence boundary and exact outgoing packets', async () => {
  const alice = new api.SecretChatSession({
    key: original(),
    peer,
    originator: true,
  });
  const bob = new api.SecretChatSession({
    key: original(),
    peer,
    originator: false,
  });
  await alice.queue(message(1), { save });
  await transfer(alice, bob);
  await bob.queue(message(2), { save });
  const legacy = portable(bob.exportState());
  legacy.version = 1;
  delete legacy.keyState;
  delete legacy.rekey;
  delete legacy.incomingKeys;
  for (const entry of legacy.outbox) {
    delete entry.digest;
  }
  const restored = new api.SecretChatSession({ state: legacy });
  assert.equal(restored.exportState().version, 2);
  assert.equal(restored.state.keys.highestCurrentSequence, 1);
  assert.equal(restored.state.rekey, null);
  assert.deepEqual(restored.pending(), bob.pending());
  const unknown = portable(legacy);
  const packet = Buffer.from(unknown.outbox[0].data, 'base64');
  packet[0] ^= 1;
  unknown.outbox[0].data = packet.toString('base64');
  assert.throws(
    () => new api.SecretChatSession({ state: unknown }),
    /key|packet|fingerprint/i
  );
});

it('keeps unauthenticated candidate packets unchanged and durably aborts authenticated old-key downgrade attempts', async () => {
  const alice = create(true);
  const bob = create(false);
  await alice.rotateKey(5n, { save });
  await transfer(alice, bob);
  await transfer(bob, alice);
  await alice.queue(message(1), { save });
  const future = alice.pending()[1].request.data;
  const before = bob.exportState();
  const corrupt = Uint8Array.from(future);
  corrupt[corrupt.length - 1] ^= 1;
  await assert.rejects(
    bob.receive(corrupt, { save }),
    (error) => error.type === 'SECRET_CHAT_BAD_PACKET'
  );
  assert.deepEqual(bob.exportState(), before);
  await bob.receive(future, { save });
  const reader = new api.SecretChatCipher(
    Buffer.from(alice.exportState().key, 'base64'),
    { originator: false }
  );
  const codec = new api.SecretChatCodec({ layer: 216 });
  const frame = codec.decode(reader.decrypt(future));
  reader.destroy();
  frame.out_seq_no += 2;
  frame.message.random_id = 22n;
  const old = new api.SecretChatCipher(original(), { originator: true });
  const packet = old.encrypt(codec.encode(frame));
  old.destroy();
  let durable;
  await assert.rejects(
    bob.receive(packet, {
      save: (state, effects) => {
        durable = portable(state);
        assert.equal(effects.aborted, true);
      },
    }),
    (error) =>
      error.type === 'SECRET_CHAT_ABORTED' &&
      error.cause.type === 'SECRET_CHAT_KEY_DOWNGRADE'
  );
  assert.equal(durable.keyState, null);
  assert.equal(durable.rekey, null);
  assert.deepEqual(durable.incomingKeys, []);
  assert.equal(bob.state.phase, 'aborted');
});

it('keeps visualization hashes stable across repeated rotations and does not count retransmissions twice', async () => {
  const alice = create(true);
  const bob = create(false);
  const expected = Uint8Array.from(alice.visualization);
  for (const id of [1n, 2n]) {
    await alice.rotateKey(id, { save });
    await transfer(alice, bob);
    await transfer(bob, alice);
    await transfer(alice, bob);
    const proof = bob.pending()[0].request.data;
    await transfer(bob, alice);
    const count = alice.state.rekey.received;
    assert.equal((await alice.receive(proof, { save })).duplicate, true);
    assert.equal(alice.state.rekey.received, count);
    for (const session of [alice, bob]) {
      assert.deepEqual(Uint8Array.from(session.visualization), expected);
      session.visualization.fill(0);
      assert.deepEqual(Uint8Array.from(session.visualization), expected);
      assert.equal(session.exportState().keyState.previous, null);
    }
  }
});

it('deletes an unacknowledged old-key message after erasure without moving its sequence or key boundary', async () => {
  let alice = create(true);
  const bob = create(false);
  await alice.rotateKey(5n, { save });
  await transfer(alice, bob);
  const oldMessage = await alice.queue(message(20), { save });
  await transfer(bob, alice);
  await bob.receive(alice.pending()[1].request.data, { save });
  await alice.queue(message(21), { save });
  await bob.receive(alice.pending()[2].request.data, { save });
  await transfer(bob, alice);
  assert.equal(alice.state.keys.previousFingerprint, null);
  assert.notEqual(bob.state.keys.previousFingerprint, null);
  const state = portable(alice.exportState());
  const prepared = state.outbox.find(
    (entry) => entry.outSequence === oldMessage.out_seq_no
  ).replacement;
  alice.destroy();
  alice = new api.SecretChatSession({ state });
  await alice.deleteUnacknowledged(oldMessage.out_seq_no, 22n, { save });
  const replacement = alice
    .pending()
    .find((entry) => entry.request.random_id === 20n);
  assert.equal(
    Buffer.from(replacement.request.data).toString('base64'),
    prepared.data
  );
  assert.deepEqual(
    new api.SecretChatSession({
      state: portable(alice.exportState()),
    }).pending(),
    alice.pending()
  );
  const recovered = await bob.receive(replacement.request.data, { save });
  assert.equal(
    recovered.messages[0].message.action._,
    'decryptedMessageActionDeleteMessages'
  );
  assert.equal(recovered.messages[0].out_seq_no, oldMessage.out_seq_no);
  assert.equal(recovered.messages.at(-1).message.message, 'message 21');
  assert.equal(bob.state.keys.previousFingerprint, null);
});

it('authenticates prepared deletion packets, validates their key epoch and includes them in the combined byte budget', async () => {
  const alice = create(true);
  await alice.queue(message(1), { save });
  const state = portable(alice.exportState());
  const entry = state.outbox.at(-1);
  assert.ok(entry.replacement);
  for (const change of [
    (s) => {
      s.outbox.at(-1).replacement = null;
    },
    (s) => {
      s.outbox.at(-1).replacement.digest = '';
    },
    (s) => {
      s.outbox.at(-1).replacement.data = entry.data;
    },
    (s) => {
      const bytes = Buffer.from(entry.replacement.data, 'base64');
      bytes[24] ^= 1;
      s.outbox.at(-1).replacement.data = bytes.toString('base64');
    },
    (s) => {
      s.outbox[0].replacement = entry.replacement;
    },
  ]) {
    const broken = portable(state);
    change(broken);
    assert.throws(() => new api.SecretChatSession({ state: broken }));
  }
  const bytes = state.outbox.reduce(
    (size, packet) =>
      size +
      Buffer.from(packet.data, 'base64').length +
      (packet.replacement
        ? Buffer.from(packet.replacement.data, 'base64').length
        : 0),
    alice.state.sequence.bufferedBytes
  );
  const exact = new api.SecretChatSession({ state, maxBufferedBytes: bytes });
  assert.deepEqual(exact.exportState(), state);
  assert.throws(
    () => new api.SecretChatSession({ state, maxBufferedBytes: bytes - 1 }),
    /limit|packet|encoding/i
  );
  const before = exact.exportState();
  await assert.rejects(exact.queue(message(2), { save }), /limit/);
  assert.deepEqual(exact.exportState(), before);
});
