import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as protocol from '../src/mtproto.js';

const portable = (state) => JSON.parse(JSON.stringify(state));
const message = (randomId, ttl = 10, media) => ({
  _: 'decryptedMessage',
  random_id: randomId,
  ttl,
  message: 'private',
  ...(media ? { media } : {}),
});
const metadata = (outgoing = true, date = 100, startOn = 'read') => ({
  outgoing,
  date,
  startOn,
});
const create = (options) => new protocol.SecretChatLifetimes(options);

it('starts text expiry at the first history read, preserves deadlines through restart and expires at the exact boundary', () => {
  const timers = create();
  assert.equal(timers.track(message(1n), metadata()), true);
  timers.track(message(2n, 5), metadata(false));
  timers.track(message(3n, 10), metadata(true, 101));
  assert.equal(timers.track(message(4n, 0), metadata()), false);
  assert.equal(timers.nextExpiration, null);
  const started = timers.readThrough(100, { outgoing: true, at: 105 });
  assert.equal(started.length, 1);
  assert.equal(started[0].randomId, 1n);
  assert.equal(started[0].expiresAt, 115);
  assert.deepEqual(timers.readThrough(100, { outgoing: true, at: 110 }), []);
  const restored = create({ state: portable(timers.exportState()) });
  assert.equal(restored.nextExpiration, 115);
  assert.deepEqual(restored.expire(114), []);
  assert.deepEqual(
    restored.expire(115).map((item) => item.randomId),
    [1n]
  );
  assert.equal(restored.size, 2);
  assert.equal(restored.nextExpiration, null);
  assert.deepEqual(restored.expire(1000), []);
  assert.equal(timers.size, 3);
});

it('keeps unopened media out of history reads and respects playback duration and direction', () => {
  const timers = create();
  timers.track(
    message(1n, 5, { _: 'decryptedMessageMediaVideo', duration: 30 }),
    metadata(true, 100, 'open')
  );
  timers.track(message(1n, 5), metadata(false));
  assert.deepEqual(timers.readThrough(100, { outgoing: true, at: 100 }), []);
  assert.equal(timers.nextExpiration, null);
  const opened = timers.read([1n, 1n], { outgoing: true, at: 102 });
  assert.equal(opened.length, 1);
  assert.equal(opened[0].ttl, 31);
  assert.equal(opened[0].expiresAt, 133);
  assert.deepEqual(timers.read([1n], { outgoing: true, at: 130 }), []);
  assert.equal(
    timers.read([1n], { outgoing: false, at: 103 })[0].expiresAt,
    108
  );
  assert.deepEqual(
    timers.expire(108).map((item) => item.outgoing),
    [false]
  );
  assert.equal(timers.nextExpiration, 133);
});

it('uses both server read timestamps without letting repeated updates extend existing deadlines', () => {
  const timers = create();
  timers.track(message(1n), metadata(true, 100));
  timers.track(message(2n), metadata(true, 111));
  const started = timers.readThrough(110, { outgoing: true, at: 105 });
  assert.equal(started[0].readAt, 110);
  assert.equal(started[0].expiresAt, 120);
  assert.deepEqual(timers.readThrough(110, { outgoing: true, at: 115 }), []);
  assert.equal(
    timers.readThrough(111, { outgoing: true, at: 110 })[0].expiresAt,
    121
  );
  const before = timers.exportState();
  assert.throws(() => timers.readThrough(111.5, { outgoing: true, at: 110 }));
  assert.deepEqual(timers.exportState(), before);
  const maximum = create();
  maximum.track(message(3n, 1, { duration: 0x7fffffff }), metadata());
  maximum.read([3n], {
    outgoing: true,
    at: Number.MAX_SAFE_INTEGER - 0x80000000,
  });
  assert.equal(maximum.nextExpiration, Number.MAX_SAFE_INTEGER);
  assert.equal(maximum.expire(Number.MAX_SAFE_INTEGER).length, 1);
});

it('handles document audio/video durations and long per-message TTL without extending nonexpiring messages', () => {
  const timers = create();
  for (const [index, kind] of ['Audio', 'Video'].entries()) {
    const media = {
      _: 'decryptedMessageMediaDocument',
      attributes: [{ _: `documentAttribute${kind}`, duration: 20.5 }],
    };
    const id = BigInt(index + 1);
    timers.track(message(id, 5, media), metadata());
    assert.equal(timers.read([id], { outgoing: true, at: 100 })[0].ttl, 21);
  }
  timers.track(message(3n, 0x7fffffff), metadata());
  assert.equal(
    timers.read([3n], { outgoing: true, at: 100 })[0].expiresAt,
    0x7fffffff + 100
  );
  assert.equal(
    timers.track(
      message(4n, 0, { _: 'decryptedMessageMediaAudio', duration: 30 }),
      metadata()
    ),
    false
  );
});

it('does not replace an existing lifetime on message replay and owns returned and exported metadata', () => {
  const timers = create();
  const original = message(-1n);
  timers.track(original, metadata());
  const first = timers.read([-1n], { outgoing: true, at: 100 });
  first[0].expiresAt = 1000;
  assert.equal(timers.track(original, metadata()), false);
  const state = timers.exportState();
  const before = portable(state);
  assert.throws(() => timers.track(message(-1n, 20), metadata()), /conflict/i);
  assert.deepEqual(timers.exportState(), before);
  state.messages[0].readAt = 999;
  assert.equal(timers.nextExpiration, 110);
  assert.equal(original.ttl, 10);
  assert.equal(JSON.stringify(before).includes('private'), false);
});

it('bounds metadata and validates complete ID lists before mutating timers', () => {
  const timers = create({ maxMessages: 1 });
  timers.track(message(1n), metadata());
  const before = portable(timers.exportState());
  assert.throws(() => timers.track(message(2n), metadata()), /limit/i);
  assert.equal(timers.track(message(3n, 0), metadata()), false);
  for (const ids of [[1n, 1], [1n, 1n << 63n], new Array(1001).fill(1n)]) {
    assert.throws(() => timers.read(ids, { outgoing: true, at: 100 }));
    assert.throws(() => timers.remove(ids));
    assert.deepEqual(timers.exportState(), before);
  }
  assert.throws(() => timers.read([1n], { outgoing: 1, at: 100 }));
  assert.throws(() => timers.readThrough(100, { outgoing: true, at: -1 }));
  assert.throws(() => timers.expire(Number.MAX_SAFE_INTEGER + 1));
  for (const [body, options] of [
    [message(2n, -1), metadata()],
    [message(2n, 0x80000000), metadata()],
    [message(2n), metadata(true, -1)],
    [message(2n), metadata(true, 100, 'send')],
    [message(2n), { outgoing: 1, date: 100, startOn: 'read' }],
    [message(2n, 5, { duration: Infinity }), metadata()],
    [message(2n, 5, { duration: -1 }), metadata()],
  ]) {
    assert.throws(() => timers.track(body, options));
    assert.deepEqual(timers.exportState(), before);
  }
  assert.deepEqual(timers.exportState(), before);
  assert.equal(timers.remove([1n]).length, 1);
  assert.equal(timers.size, 0);
});

it('rejects malformed, duplicate and over-limit portable lifetime snapshots', () => {
  const timers = create({ maxMessages: 2 });
  timers.track(message(1n), metadata());
  for (const change of [
    (state) => (state.version = 2),
    (state) => (state.maxMessages = 10001),
    (state) => (state.messages[0].randomId = '01'),
    (state) => (state.messages[0].randomId = 1),
    (state) => (state.messages[0].outgoing = 1),
    (state) => (state.messages[0].ttl = 0),
    (state) => (state.messages[0].ttl = 0x80000001),
    (state) => (state.messages[0].startOn = 'send'),
    (state) => (state.messages[0].readAt = -1),
    (state) => state.messages.push({ ...state.messages[0] }),
    (state) => (state.messages = null),
  ]) {
    const state = portable(timers.exportState());
    change(state);
    assert.throws(() => create({ state }));
  }
  assert.throws(() => create({ state: timers.exportState(), maxMessages: 1 }));
  assert.equal(create({ state: portable(timers.exportState()) }).size, 1);
});

it('applies read/delete/history services without changing timers for protocol-owned actions', () => {
  const timers = create();
  for (const outgoing of [false, true]) {
    timers.track(message(1n), metadata(outgoing));
  }
  const read = timers.applyService(
    { _: 'decryptedMessageActionReadMessages', random_ids: [1n] },
    { at: 100 }
  );
  assert.equal(read.started.length, 1);
  assert.equal(read.started[0].outgoing, true);
  assert.deepEqual(read.removed, []);
  assert.deepEqual(
    timers.applyService({ _: 'decryptedMessageActionNotifyLayer', layer: 144 }),
    { started: [], removed: [] }
  );
  const deleted = timers.applyService({
    _: 'decryptedMessageActionDeleteMessages',
    random_ids: [1n],
  });
  assert.equal(deleted.removed.length, 2);
  assert.equal(timers.size, 0);
  timers.track(message(2n), metadata());
  assert.equal(
    timers.applyService({ _: 'decryptedMessageActionFlushHistory' }).removed
      .length,
    1
  );
  assert.deepEqual(timers.clear(), []);
});

it('commits ordered read receipts and expired application history atomically with secret session state', async () => {
  const key = new Uint8Array(256).fill(7);
  const peer = { _: 'inputEncryptedChat', chat_id: 123, access_hash: 456n };
  const sender = new protocol.SecretChatSession({
    key,
    peer,
    originator: true,
    remoteLayer: 144,
  });
  const receiver = new protocol.SecretChatSession({
    key,
    peer,
    originator: false,
    remoteLayer: 144,
  });
  let durable = { timers: create().exportState(), history: new Map() };
  const frame = await sender.queue(message(1n), { save: () => {} });
  const timerDraft = create({ state: durable.timers });
  timerDraft.track(frame.message, metadata());
  durable = {
    timers: portable(timerDraft.exportState()),
    history: new Map([[1n, 'private']]),
  };
  for (const packet of sender.pending()) {
    await receiver.receive(packet.request.data, { save: () => {} });
  }
  await receiver.queueService(
    { _: 'decryptedMessageActionReadMessages', random_ids: [1n] },
    { save: () => {} }
  );
  let fail = true;
  const save = (state, effects) => {
    const draft = create({ state: durable.timers });
    for (const received of effects.messages) {
      draft.applyService(received.message.action, { at: 100 });
    }
    if (fail) {
      throw new Error('transaction failed');
    }
    durable = {
      ...durable,
      session: state,
      timers: portable(draft.exportState()),
    };
  };
  const packets = receiver.pending();
  await assert.rejects(
    sender.receive(packets[0].request.data, { save }),
    /transaction failed/
  );
  assert.equal(create({ state: durable.timers }).nextExpiration, null);
  fail = false;
  for (const packet of packets) {
    await sender.receive(packet.request.data, { save });
  }
  assert.equal(create({ state: durable.timers }).nextExpiration, 110);
  const restored = create({ state: durable.timers });
  const history = new Map(durable.history);
  for (const expired of restored.expire(110)) {
    history.delete(expired.randomId);
  }
  durable = { ...durable, history, timers: portable(restored.exportState()) };
  assert.equal(durable.history.size, 0);
  assert.equal(create({ state: durable.timers }).size, 0);
});

it('durably removes acknowledged protocol plaintext and ciphertext without moving sequence counters', async () => {
  const key = new Uint8Array(256).fill(7);
  const peer = { _: 'inputEncryptedChat', chat_id: 123, access_hash: 456n };
  const sender = new protocol.SecretChatSession({
    key,
    peer,
    originator: true,
    remoteLayer: 144,
  });
  const receiver = new protocol.SecretChatSession({
    key,
    peer,
    originator: false,
    remoteLayer: 144,
  });
  const save = () => {};
  await sender.queue(message(1n), { save });
  for (const packet of sender.pending()) {
    await receiver.receive(packet.request.data, { save });
  }
  await receiver.queueService(
    { _: 'decryptedMessageActionReadMessages', random_ids: [1n] },
    { save }
  );
  for (const packet of receiver.pending()) {
    await sender.receive(packet.request.data, { save });
  }
  const before = portable(sender.exportState());
  assert.ok(before.sequence.history.length > 0);
  const deleted = new protocol.SecretChatSession({ state: portable(before) });
  await deleted.queueService(
    { _: 'decryptedMessageActionDeleteMessages', random_ids: [1n] },
    { save }
  );
  assert.equal(deleted.exportState().sequence.history.length, 1);
  assert.equal(deleted.exportState().outbox.length, 1);
  await assert.rejects(
    sender.pruneAcknowledged({
      save: () => {
        throw new Error('expiry save failed');
      },
    }),
    /expiry save failed/
  );
  assert.deepEqual(sender.exportState(), before);
  const counters = sender.state.sequence;
  const removed = await sender.pruneAcknowledged({ save });
  assert.equal(removed, before.sequence.history.length);
  const after = sender.exportState();
  assert.deepEqual(after.sequence.history, []);
  assert.deepEqual(after.outbox, []);
  for (const name of ['incoming', 'outgoing', 'acknowledged']) {
    assert.equal(sender.state.sequence[name], counters[name]);
  }
  const restored = new protocol.SecretChatSession({ state: portable(after) });
  assert.deepEqual(restored.pending(), []);
  assert.equal(await restored.pruneAcknowledged({ save }), 0);
});
