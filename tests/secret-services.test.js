import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  SecretChatSession,
  SecretChatCipher,
  SecretChatCodec,
  SecretChatSequence,
} from '../src/mtproto.js';

const key = new Uint8Array(256).fill(7);
const peer = { _: 'inputEncryptedChat', chat_id: 123, access_hash: 456n };
const create = (originator = true) =>
  new SecretChatSession({ key, originator, peer, remoteLayer: 144 });
const save = () => {};
const portable = (value) => JSON.parse(JSON.stringify(value));
const ttl = (seconds) => ({
  _: 'decryptedMessageActionSetMessageTTL',
  ttl_seconds: seconds,
});
const message = (id, extra = {}) => ({
  _: 'decryptedMessage',
  random_id: id,
  message: 'secret',
  ...extra,
});

it('persists service TTL changes with their encrypted outbox and applies defaults only to future messages', async () => {
  const session = create();
  const original = message(1n);
  const first = await session.queue(original, { save });
  assert.equal(first.message.ttl, 0);
  await session.queueService(ttl(30), { save, randomId: 2n });
  assert.equal(session.state.messageTTL, 30);
  const next = await session.queue(message(3n), { save });
  assert.equal(next.message.ttl, 30);
  assert.equal(first.message.ttl, 0);
  assert.equal(original.ttl, undefined);
  assert.equal(
    (await session.queue(message(4n, { ttl: 0 }), { save })).message.ttl,
    0
  );
  const state = portable(session.exportState());
  const restored = new SecretChatSession({ state });
  assert.deepEqual(restored.pending(), session.pending());
  assert.equal((await restored.queue(message(5n), { save })).message.ttl, 30);
});

it('applies incoming TTL services in sequence after restart and rolls back failed durable saves', async () => {
  const sender = create();
  const receiver = create(false);
  await sender.queueService(ttl(30), { save, randomId: 1n });
  await sender.queueService(ttl(60), { save, randomId: 2n });
  const packets = sender.pending();
  await receiver.receive(packets[2].request.data, { save });
  assert.equal(receiver.state.messageTTL, 0);
  const restored = new SecretChatSession({
    state: portable(receiver.exportState()),
  });
  const before = restored.exportState();
  await assert.rejects(
    restored.receive(packets[0].request.data, {
      save: () => {
        throw new Error('service save failed');
      },
    }),
    /service save failed/
  );
  assert.deepEqual(restored.exportState(), before);
  await restored.receive(packets[0].request.data, { save });
  assert.equal(restored.state.messageTTL, 0);
  const ordered = await restored.receive(packets[1].request.data, { save });
  assert.deepEqual(
    ordered.messages.map((frame) => frame.message.action.ttl_seconds),
    [30, 60]
  );
  assert.equal(restored.state.messageTTL, 60);
  assert.equal((await restored.queue(message(3n), { save })).message.ttl, 60);
});

it('rejects invalid outbound TTL values before consuming a sequence or changing the default', async () => {
  const session = create();
  for (const value of [-1, 0.5, null, '30']) {
    const before = session.exportState();
    await assert.rejects(
      session.queue(message(1n, { ttl: value }), { save }),
      /TTL|lifetime/
    );
    await assert.rejects(
      session.queueService(ttl(value), { save }),
      /TTL|lifetime/
    );
    assert.deepEqual(session.exportState(), before);
  }
  await assert.rejects(session.queueService(ttl(31536001), { save }), /TTL/);
});

it('preserves explicit per-message lifetimes across the positive TL integer range', async () => {
  const session = create();
  await session.queueService(ttl(30), { save, randomId: 1n });
  for (const [index, seconds] of [31536001, 0x7fffffff].entries()) {
    const frame = await session.queue(
      message(BigInt(index + 2), { ttl: seconds }),
      { save }
    );
    assert.equal(frame.message.ttl, seconds);
    assert.equal(session.state.messageTTL, 30);
  }
  await assert.rejects(
    session.queue(message(5n, { ttl: 0x80000000 }), { save }),
    /TTL/
  );
});

it('rolls back failed service persistence and validates bounded application action IDs', async () => {
  const session = create();
  const before = session.exportState();
  await assert.rejects(
    session.queueService(ttl(30), {
      save: () => {
        throw new Error('service disk failed');
      },
      randomId: 1n,
    }),
    /service disk failed/
  );
  assert.deepEqual(session.exportState(), before);
  for (const action of [
    {
      _: 'decryptedMessageActionReadMessages',
      random_ids: new Array(1001).fill(1n),
    },
    { _: 'decryptedMessageActionReadMessages', random_ids: [1] },
    { _: 'decryptedMessageActionDeleteMessages', random_ids: [1n << 63n] },
    { _: 'decryptedMessageActionScreenshotMessages', random_ids: null },
    {
      _: 'decryptedMessageActionRequestKey',
      exchange_id: 1n,
      g_a: new Uint8Array(),
    },
    { _: 'decryptedMessageActionNotifyLayer', layer: 144 },
    { _: 'unknown' },
  ]) {
    await assert.rejects(session.queueService(action, { save }));
    assert.deepEqual(session.exportState(), before);
  }
  await assert.rejects(
    session.queueService(ttl(0), { save, randomId: 1n << 63n })
  );
  assert.deepEqual(session.exportState(), before);
});

it('delivers copied read, delete, screenshot, history and typing services through exact durable retries', async () => {
  const sender = create();
  const receiver = create(false);
  const ids = [-(1n << 63n), (1n << 63n) - 1n];
  const actions = [
    ...['ReadMessages', 'DeleteMessages', 'ScreenshotMessages'].map((name) => ({
      _: `decryptedMessageAction${name}`,
      random_ids: [...ids, ids[0]],
    })),
    { _: 'decryptedMessageActionFlushHistory' },
    {
      _: 'decryptedMessageActionTyping',
      action: { _: 'sendMessageTypingAction' },
    },
  ];
  for (const [index, action] of actions.entries()) {
    await sender.queueService(action, { save, randomId: BigInt(index + 1) });
  }
  actions[0].random_ids.fill(0n);
  const restored = new SecretChatSession({
    state: portable(sender.exportState()),
  });
  assert.deepEqual(restored.pending(), sender.pending());
  const delivered = [];
  for (const packet of restored.pending()) {
    assert.equal(packet.request._, 'messages.sendEncryptedService');
    const result = await receiver.receive(packet.request.data, {
      save: (_, effects) => delivered.push(...effects.messages),
    });
    assert.equal(result.messages.length, 1);
  }
  const received = delivered.slice(1).map((frame) => frame.message.action);
  assert.equal(received.length, 5);
  for (const action of received.slice(0, 3)) {
    assert.deepEqual(action.random_ids, ids);
  }
  assert.equal(received[3]._, 'decryptedMessageActionFlushHistory');
  assert.equal(received[4].action._, 'sendMessageTypingAction');
  assert.equal(receiver.state.messageTTL, 0);
});

it('clamps invalid received TTL settings to the official peer limit without changing raw effects', async () => {
  for (const seconds of [-1, 31536001, 0, 31536000]) {
    const receiver = create(false);
    const sequence = new SecretChatSequence({ originator: true });
    const cipher = new SecretChatCipher(key, { originator: true });
    try {
      const frame = sequence.create({
        _: 'decryptedMessageService',
        random_id: 1n,
        action: ttl(seconds),
      });
      const packet = cipher.encrypt(
        new SecretChatCodec().encode(frame, 'DecryptedMessageLayer')
      );
      const result = await receiver.receive(packet, { save });
      const expected = seconds < 0 || seconds > 31536000 ? 31536000 : seconds;
      assert.equal(receiver.state.messageTTL, expected);
      assert.equal(result.messages[0].message.action.ttl_seconds, seconds);
      assert.equal(
        (await receiver.queue(message(2n), { save })).message.ttl,
        expected
      );
    } finally {
      receiver.destroy();
      cipher.destroy();
      sequence.destroy();
    }
  }
});

it('restores older sessions with a zero default and rejects malformed saved lifetimes', async () => {
  const state = portable(create().exportState());
  delete state.messageTTL;
  assert.equal(new SecretChatSession({ state }).state.messageTTL, 0);
  for (const value of [null, -1, 31536001, 0.5, '30']) {
    assert.throws(
      () => new SecretChatSession({ state: { ...state, messageTTL: value } }),
      /TTL/
    );
  }
});
