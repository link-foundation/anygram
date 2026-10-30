import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as protocol from '../src/mtproto.js';

const message = (id) => ({
  _: 'decryptedMessage',
  random_id: BigInt(id),
  ttl: 0,
  message: String(id),
});
const service = (id, action) => ({
  _: 'decryptedMessageService',
  random_id: BigInt(id),
  action,
});
const peer = (originator, options) =>
  new protocol.SecretChatSequence({ originator, ...options });
const aborted = (error) => error.type === 'SECRET_CHAT_ABORTED';

it('assigns secret-chat role parity and immutable sequence numbers at message creation', () => {
  const creator = peer(true);
  const recipient = peer(false);
  const first = creator.create(message(1));
  assert.equal(first.out_seq_no, 1);
  assert.equal(first.in_seq_no, 0);
  assert.equal(first.random_bytes.length, 16);
  assert.equal(first.layer, 144);
  assert.equal(recipient.receive(first).messages[0].message.message, '1');
  const reply = recipient.create(message(2));
  assert.equal(reply.out_seq_no, 0);
  assert.equal(reply.in_seq_no, 3);
  creator.receive(reply);
  const next = creator.create(service(3, { _: 'decryptedMessageActionNoop' }));
  assert.equal(next.out_seq_no, 3);
  assert.equal(next.in_seq_no, 2);
  assert.equal(first.in_seq_no, 0);
  assert.equal(creator.state.acknowledged, 1);
});

it('drops processed and queued duplicates without interpreting their contents', () => {
  const sender = peer(true);
  const receiver = peer(false);
  const first = sender.create(message(1));
  receiver.receive(first);
  const duplicate = { ...first, in_seq_no: 2000 };
  Object.defineProperty(duplicate, 'message', {
    get() {
      throw Error('must not inspect');
    },
  });
  assert.equal(receiver.receive(duplicate).duplicate, true);
  sender.create(message(2));
  const third = sender.create(message(3));
  receiver.receive(third);
  const queued = { ...third };
  Object.defineProperty(queued, 'message', {
    get() {
      throw Error('must not inspect');
    },
  });
  assert.equal(receiver.receive(queued).duplicate, true);
  assert.equal(receiver.state.incoming, 1);
  assert.equal(receiver.state.pending, 1);
});

it('requests each gap once using wire parity and drains buffered messages in order', () => {
  for (const originator of [true, false]) {
    const sender = peer(originator);
    const receiver = peer(!originator);
    const frames = [1, 2, 3, 4].map((id) => sender.create(message(id)));
    const gap = receiver.receive(frames[2]);
    const offset = originator ? 1 : 0;
    assert.deepEqual(gap.resend, {
      _: 'decryptedMessageActionResend',
      start_seq_no: offset,
      end_seq_no: 2 + offset,
    });
    assert.equal(receiver.receive(frames[3]).resend, undefined);
    assert.deepEqual(
      receiver
        .receive(frames[0])
        .messages.map((value) => value.message.message),
      ['1']
    );
    assert.deepEqual(
      receiver
        .receive(frames[1])
        .messages.map((value) => value.message.message),
      ['2', '3', '4']
    );
    assert.equal(receiver.state.incoming, 4);
    assert.equal(receiver.state.pending, 0);
  }
});

it('breaks concurrent gaps by handling out-of-order resend services immediately exactly once', () => {
  const left = peer(true);
  const right = peer(false);
  const leftFrames = [1, 2].map((id) => left.create(message(id)));
  const rightFrames = [3, 4].map((id) => right.create(message(id)));
  const leftGap = right.receive(leftFrames[1]);
  const rightGap = left.receive(rightFrames[1]);
  const leftRequest = left.create(service(5, rightGap.resend));
  const rightRequest = right.create(service(6, leftGap.resend));
  const leftResend = left.receive(rightRequest);
  const rightResend = right.receive(leftRequest);
  assert.deepEqual(leftResend.retransmit, [leftFrames[0]]);
  assert.deepEqual(rightResend.retransmit, [rightFrames[0]]);
  assert.deepEqual(
    left
      .receive(rightResend.retransmit[0])
      .messages.map((value) => value.message.message),
    ['3', '4']
  );
  assert.deepEqual(
    right
      .receive(leftResend.retransmit[0])
      .messages.map((value) => value.message.message),
    ['1', '2']
  );
  assert.equal(left.state.incoming, 3);
  assert.equal(right.state.incoming, 3);
  assert.deepEqual(left.receive(rightRequest).retransmit, []);
});

it('checks acknowledgement bounds at arrival and monotonicity in message order', () => {
  const left = peer(true);
  const right = peer(false);
  const sent = left.create(message(1));
  const earlier = right.create(message(2));
  right.receive(sent);
  const later = right.create(message(3));
  left.receive(later);
  assert.deepEqual(
    left.receive(earlier).messages.map((value) => value.message.message),
    ['2', '3']
  );
  assert.equal(left.state.acknowledged, 1);
  const decreasing = right.create(message(4));
  decreasing.in_seq_no = 1;
  assert.throws(() => left.receive(decreasing), aborted);
  assert.equal(left.state.aborted, true);
  const untouched = peer(true);
  assert.throws(() => untouched.receive({ ...earlier, in_seq_no: 3 }), aborted);
});

it('aborts on reflection, invalid counters and unsatisfiable or wrong-parity resend requests', () => {
  for (const changes of [
    { out_seq_no: 0 },
    { in_seq_no: 1 },
    { out_seq_no: -1 },
    { out_seq_no: 1.5 },
    { in_seq_no: 2147483648 },
  ]) {
    const source = peer(true).create(message(1));
    const receiver = peer(false);
    assert.throws(() => receiver.receive({ ...source, ...changes }), aborted);
    assert.equal(receiver.state.aborted, true);
    assert.throws(() => receiver.create(message(2)), aborted);
  }
  for (const [start, end] of [
    [0, 0],
    [3, 1],
    [1, 3],
    [-1, 1],
    [1, 2147483647],
  ]) {
    const left = peer(true);
    left.create(message(1));
    const request = peer(false).create(
      service(2, {
        _: 'decryptedMessageActionResend',
        start_seq_no: start,
        end_seq_no: end,
      })
    );
    assert.throws(() => left.receive(request), aborted);
  }
});

it('ignores insufficient random padding without advancing secret sequence state', () => {
  const receiver = peer(false);
  const frame = peer(true).create(message(1));
  for (const size of [0, 14]) {
    assert.equal(
      receiver.receive({ ...frame, random_bytes: new Uint8Array(size) })
        .ignored,
      true
    );
    assert.equal(receiver.state.incoming, 0);
  }
  assert.equal(
    receiver.receive({ ...frame, random_bytes: new Uint8Array(15) }).messages
      .length,
    1
  );
});

it('bounds pending messages and aborts with no retained plaintext after overflow', () => {
  const sender = peer(true);
  const receiver = peer(false, { maxPending: 2 });
  sender.create(message(1));
  const frames = [2, 3, 4].map((id) => sender.create(message(id)));
  receiver.receive(frames[0]);
  receiver.receive(frames[1]);
  assert.throws(() => receiver.receive(frames[2]), aborted);
  assert.equal(receiver.state.pending, 0);
  assert.equal(receiver.state.bufferedBytes, 0);
});

it('bounds unacknowledged history without consuming sequence numbers and evicts acknowledged entries', () => {
  const left = peer(true, { maxHistory: 2 });
  const right = peer(false);
  const first = left.create(message(1));
  left.create(message(2));
  assert.throws(() => left.create(message(3)), /history limit/i);
  assert.equal(left.state.outgoing, 2);
  right.receive(first);
  left.receive(right.create(message(4)));
  assert.equal(left.create(message(5)).out_seq_no, 5);
  assert.equal(left.state.history, 2);
});

it('copies cached frames and bounds total plaintext bytes before accepting outgoing work', () => {
  const left = peer(true, { maxBufferedBytes: 256 });
  const right = peer(false);
  const input = message(1);
  const first = left.create(input);
  input.message = 'modified';
  first.message.message = 'modified again';
  const request = right.create(
    service(2, {
      _: 'decryptedMessageActionResend',
      start_seq_no: 1,
      end_seq_no: 1,
    })
  );
  assert.equal(left.receive(request).retransmit[0].message.message, '1');
  const counter = left.state.outgoing;
  assert.throws(
    () => left.create({ ...message(3), message: 'x'.repeat(300) }),
    /byte limit/i
  );
  assert.equal(left.state.outgoing, counter);
  left.destroy();
  assert.equal(left.state.bufferedBytes, 0);
  assert.throws(() => left.receive(request), aborted);
});

it('validates secret sequence limits and negotiated layer before allocating state', () => {
  for (const options of [
    {},
    { originator: 1 },
    { originator: true, layer: 16 },
    { originator: true, layer: 217 },
    { originator: true, maxPending: 0 },
    { originator: true, maxHistory: Infinity },
    { originator: true, maxBufferedBytes: 128 },
    { originator: true, maxPending: 10001 },
  ]) {
    assert.throws(() => new protocol.SecretChatSequence(options));
  }
});

it('accepts a missing message while the pending queue is full and requests a later separate hole', () => {
  const sender = peer(true);
  const receiver = peer(false, { maxPending: 2 });
  const frames = [1, 2, 3, 4, 5].map((id) => sender.create(message(id)));
  receiver.receive(frames[1]);
  receiver.receive(frames[2]);
  assert.equal(receiver.receive(frames[0]).messages.length, 3);
  const later = receiver.receive(frames[4]);
  assert.deepEqual(later.resend, {
    _: 'decryptedMessageActionResend',
    start_seq_no: 7,
    end_seq_no: 7,
  });
  assert.equal(receiver.receive(frames[3]).messages.length, 2);
});

it('rejects an impossible acknowledgement immediately even on an out-of-order message', () => {
  const receiver = peer(true);
  const sender = peer(false);
  sender.create(message(1));
  const gap = sender.create(message(2));
  gap.in_seq_no = 3;
  assert.throws(() => receiver.receive(gap), aborted);
  assert.equal(receiver.state.pending, 0);
});

it('handles a retransmission range whose cached messages include acknowledged history', () => {
  const sender = peer(true);
  const receiver = peer(false);
  const frames = [1, 2, 3].map((id) => sender.create(message(id)));
  receiver.receive(frames[0]);
  sender.receive(receiver.create(message(4)));
  const request = receiver.create(
    service(5, {
      _: 'decryptedMessageActionResend',
      start_seq_no: 1,
      end_seq_no: 5,
    })
  );
  const resent = sender.receive(request).retransmit;
  assert.deepEqual(resent, frames);
  resent[0].random_bytes.fill(0);
  const next = receiver.create(service(6, request.message.action));
  assert.deepEqual(sender.receive(next).retransmit, frames);
});

it('restores JSON-portable secret sequence state without replaying handled resend services', () => {
  const left = peer(true);
  const right = peer(false);
  const first = left.create(message(1));
  const second = left.create(message(2));
  right.create(message(3));
  right.receive(second);
  const request = left.create(
    service(4, {
      _: 'decryptedMessageActionResend',
      start_seq_no: 0,
      end_seq_no: 0,
    })
  );
  assert.equal(right.receive(request).retransmit.length, 1);
  const restored = peer(false, {
    state: JSON.parse(JSON.stringify(right.exportState())),
  });
  assert.deepEqual(restored.state, right.state);
  assert.equal(restored.receive(request).duplicate, true);
  const delivered = restored.receive(first);
  assert.deepEqual(
    delivered.messages.map((frame) => frame.message.message),
    ['1', '2']
  );
  assert.deepEqual(delivered.retransmit, []);
  assert.equal(restored.create(message(5)).out_seq_no, 2);
  assert.equal(restored.state.incoming, 3);
});

it('validates restored counters, role, schema, canonical bytes, cache continuity and limits', () => {
  const original = peer(true);
  original.create(message(1));
  original.create(message(2));
  const state = original.exportState();
  for (const changes of [
    { version: 2 },
    { originator: false },
    { layer: 17 },
    { incoming: -1 },
    { outgoing: 1.5 },
    { acknowledged: 3 },
    { history: [] },
    { history: [state.history[1]] },
    { history: [state.history[0], state.history[0]] },
    { history: ['!!!!'] },
    { history: ['A'.repeat(400)] },
    { pending: [state.history[0]] },
    { requestedUntil: 0 },
  ]) {
    assert.throws(() =>
      peer(true, { state: { ...state, ...changes }, maxBufferedBytes: 256 })
    );
  }
  assert.throws(() => peer(true, { state, maxHistory: 1 }));
});

it('restores pending cache independently and rejects a gap with no persisted resend range', () => {
  const sender = peer(true);
  sender.create(message(1));
  const gap = sender.create(message(2));
  const receiver = peer(false);
  receiver.receive(gap);
  const state = receiver.exportState();
  assert.throws(() =>
    peer(false, { state: { ...state, requestedUntil: null } })
  );
  const restored = peer(false, { state });
  state.pending[0] = '';
  const first = sender.exportState().history[0];
  const frame = new protocol.SecretChatCodec().decode(
    Uint8Array.from(Buffer.from(first, 'base64'))
  );
  assert.equal(restored.receive(frame).messages.length, 2);
});

it('bounds restored sequence exhaustion without allocating a large history or wrapping wire counters', () => {
  const sequence = peer(true);
  const state = sequence.exportState();
  const maximum = 0x3fffffff;
  const restored = peer(true, {
    state: { ...state, outgoing: maximum, acknowledged: maximum },
  });
  assert.throws(() => restored.create(message(1)), /counter exhausted/i);
  assert.equal(restored.state.outgoing, maximum);
  const remote = peer(false).create(message(2));
  remote.out_seq_no = 2 * maximum;
  assert.throws(() => sequence.receive(remote), aborted);
});

it('recovers unsent frames and the current gap request after a restart', () => {
  const left = peer(true);
  const right = peer(false);
  const first = left.create(message(1));
  const second = left.create(message(2));
  right.receive(second);
  const restored = peer(false, { state: right.exportState() });
  assert.deepEqual(restored.resendRequest(), {
    _: 'decryptedMessageActionResend',
    start_seq_no: 1,
    end_seq_no: 1,
  });
  assert.deepEqual(peer(true, { state: left.exportState() }).unacknowledged(), [
    first,
    second,
  ]);
  restored.receive(first);
  assert.equal(restored.resendRequest(), undefined);
  left.receive(restored.create(message(3)));
  assert.deepEqual(left.unacknowledged(), []);
});
