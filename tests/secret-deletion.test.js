import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { SecretChatSequence } from '../src/mtproto.js';

const text = (id) => ({
  _: 'decryptedMessage',
  random_id: BigInt(id),
  ttl: 0,
  message: 'plaintext that must leave the resend cache',
});
const sequence = (originator, options) =>
  new SecretChatSequence({ originator, ...options });
const deletionAction = (id) => ({
  _: 'decryptedMessageActionDeleteMessages',
  random_ids: [BigInt(id)],
});

it('substitutes unacknowledged secret text with self-deletion and a new deletion service', () => {
  for (const originator of [true, false]) {
    const sender = sequence(originator);
    const receiver = sequence(!originator);
    const original = sender.create(text(1));
    sender.receive(receiver.create(text(2)));
    const { replacement, deletion } = sender.deleteUnacknowledged(
      original.out_seq_no,
      3n
    );
    assert.deepEqual(replacement, {
      ...original,
      message: {
        _: 'decryptedMessageService',
        random_id: 1n,
        action: deletionAction(1),
      },
    });
    assert.equal(deletion.out_seq_no, original.out_seq_no + 2);
    assert.equal(deletion.in_seq_no, original.in_seq_no + 2);
    assert.equal(deletion.message.random_id, 3n);
    assert.deepEqual(deletion.message.action, deletionAction(1));
    assert.equal(sender.state.outgoing, 2);
    const request = receiver.create({
      _: 'decryptedMessageService',
      random_id: 4n,
      action: {
        _: 'decryptedMessageActionResend',
        start_seq_no: original.out_seq_no,
        end_seq_no: original.out_seq_no,
      },
    });
    assert.deepEqual(sender.receive(request).retransmit, [replacement]);
    assert.equal(original.message.message, text(1).message);
    replacement.message.action.random_ids[0] = 999n;
    assert.deepEqual(
      sender.unacknowledged()[0].message.action,
      deletionAction(1)
    );
  }
});

it('preserves sequence continuity whether the deleted secret message reached its peer or not', () => {
  for (const delivered of [true, false]) {
    const sender = sequence(true);
    const receiver = sequence(false);
    const original = sender.create(text(5));
    if (delivered) {
      receiver.receive(original);
    }
    const effects = sender.deleteUnacknowledged(original.out_seq_no);
    assert.equal(typeof effects.deletion.message.random_id, 'bigint');
    assert.notEqual(effects.deletion.message.random_id, 5n);
    const first = receiver.receive(effects.replacement);
    assert.equal(first.duplicate, delivered);
    assert.equal(first.messages.length, Number(!delivered));
    const next = receiver.receive(effects.deletion);
    assert.deepEqual(next.messages[0].message.action, deletionAction(5));
    assert.equal(receiver.state.incoming, 2);
    const restored = sequence(true, {
      state: JSON.parse(JSON.stringify(sender.exportState())),
    });
    assert.deepEqual(restored.unacknowledged(), [
      effects.replacement,
      effects.deletion,
    ]);
    for (const entry of restored.exportState().history) {
      assert.equal(
        Buffer.from(entry, 'base64').includes(text(5).message),
        false
      );
    }
    assert.throws(
      () => restored.deleteUnacknowledged(original.out_seq_no),
      /message/i
    );
  }
});

it('rejects invalid deletion targets and reserves capacity before changing cached messages', () => {
  const sender = sequence(true, { maxHistory: 1 });
  const original = sender.create(text(1));
  const before = sender.exportState();
  assert.throws(
    () => sender.deleteUnacknowledged(original.out_seq_no, 2n),
    /limit/i
  );
  assert.deepEqual(sender.exportState(), before);
  for (const target of [-1, 0, 3, 1.5]) {
    assert.throws(
      () => sender.deleteUnacknowledged(target, 2n),
      /sequence|message/i
    );
    assert.deepEqual(sender.exportState(), before);
  }
  const available = sequence(true);
  const frame = available.create(text(1));
  const availableBefore = available.exportState();
  for (const id of [1n, 1n << 63n, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => available.deleteUnacknowledged(frame.out_seq_no, id));
    assert.deepEqual(available.exportState(), availableBefore);
    assert.equal(
      available.unacknowledged()[0].message.message,
      text(1).message
    );
  }
  const recipient = sequence(false);
  recipient.receive(frame);
  available.receive(recipient.create(text(3)));
  const acknowledged = available.exportState();
  assert.throws(
    () => available.deleteUnacknowledged(frame.out_seq_no, 2n),
    /message/i
  );
  assert.deepEqual(available.exportState(), acknowledged);
  available.destroy();
  assert.throws(() => available.deleteUnacknowledged(frame.out_seq_no, 2n), {
    type: 'SECRET_CHAT_ABORTED',
  });
});

it('keeps all cached state when deletion cannot fit after evicting acknowledged history', () => {
  const sender = sequence(true);
  const receiver = sequence(false);
  const first = sender.create({ ...text(1), message: 'a' });
  const second = sender.create({ ...text(2), message: 'b' });
  receiver.receive(first);
  sender.receive(receiver.create(text(3)));
  receiver.create(text(4));
  sender.receive(receiver.create({ ...text(5), message: 'x'.repeat(200) }));
  const bounded = sequence(true, {
    state: sender.exportState(),
    maxBufferedBytes: sender.state.bufferedBytes,
  });
  const before = bounded.exportState();
  assert.throws(
    () => bounded.deleteUnacknowledged(second.out_seq_no, 6n),
    /limit/i
  );
  assert.deepEqual(bounded.exportState(), before);
  assert.equal(bounded.state.aborted, false);
});

it('evicts acknowledged history to reserve both deletion frames when capacity permits', () => {
  const sender = sequence(true, { maxHistory: 2 });
  const receiver = sequence(false);
  const first = sender.create(text(1));
  const second = sender.create(text(2));
  receiver.receive(first);
  sender.receive(receiver.create(text(3)));
  const effects = sender.deleteUnacknowledged(second.out_seq_no, 4n);
  assert.equal(sender.state.history, 2);
  assert.equal(sender.state.acknowledged, 1);
  assert.deepEqual(
    sequence(true, {
      state: sender.exportState(),
      maxHistory: 2,
    }).unacknowledged(),
    [effects.replacement, effects.deletion]
  );
});
