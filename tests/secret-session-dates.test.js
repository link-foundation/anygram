import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { SecretChatSession, SecretChatLifetimes } from '../src/mtproto.js';

const key = new Uint8Array(256).fill(7);
const peer = { _: 'inputEncryptedChat', chat_id: 123, access_hash: 456n };
const create = (originator = true, extra = {}) =>
  new SecretChatSession({ key, peer, originator, remoteLayer: 144, ...extra });
const portable = (state) => JSON.parse(JSON.stringify(state));
const save = () => {};
const message = (id) => ({
  _: 'decryptedMessage',
  random_id: id,
  ttl: 10,
  message: 'private',
});
const client = () => {
  let id = 0n;
  return {
    callWithReceipt: async () => ({
      messageId: (id += 4n),
      dc: 2,
      value: { _: 'messages.sentEncryptedMessage', date: Number(id) + 100 },
    }),
  };
};

it('commits outgoing server dates and owned message bodies with submitted state before read-based expiry', async () => {
  const session = create();
  await session.queue(message(1n), { save });
  const sent = [];
  let timers = new SecretChatLifetimes();
  await session.flush(client(), {
    save: (state, effects) => {
      const draft = new SecretChatLifetimes({ state: timers.exportState() });
      for (const entry of effects.sent ?? []) {
        assert.equal(
          state.outbox.find(
            (packet) => packet.outSequence === entry.outSequence
          ).submitted,
          true
        );
        assert.equal(entry.randomId, entry.message.random_id);
        if (entry.message._ === 'decryptedMessage') {
          draft.track(entry.message, {
            outgoing: true,
            date: entry.date,
            startOn: 'read',
          });
        }
        sent.push(entry);
        entry.message.message = 'changed callback copy';
      }
      timers = draft;
    },
  });
  assert.equal(sent.length, 2);
  assert.equal(timers.exportState().messages[0].date, 108);
  assert.equal(
    timers.readThrough(108, { outgoing: true, at: 109 })[0].expiresAt,
    119
  );
  assert.deepEqual(session.pending(), []);
  const restored = new SecretChatSession({
    state: portable(session.exportState()),
  });
  assert.deepEqual(restored.exportState(), session.exportState());
});

it('does not publish outgoing dates on failed persistence and retries the exact ciphertext after restart', async () => {
  const session = create();
  await session.queue(message(1n), { save });
  const before = portable(session.exportState());
  const pending = session.pending();
  let saw = false;
  await assert.rejects(
    session.flush(client(), {
      save: (_, effects) => {
        assert.equal(effects.sent.length, 1);
        saw = true;
        throw new Error('date storage failed');
      },
    }),
    /date storage failed/
  );
  assert.equal(saw, true);
  assert.deepEqual(session.exportState(), before);
  const restored = new SecretChatSession({ state: portable(before) });
  assert.deepEqual(restored.pending(), pending);
  const dates = [];
  await restored.flush(client(), {
    save: (_, effects) => dates.push(...effects.sent),
  });
  assert.deepEqual(
    dates.map((entry) => entry.date),
    [104, 108]
  );
});

it('preserves original incoming dates across gaps, duplicate updates and JSON restart', async () => {
  const sender = create();
  let receiver = create(false);
  for (const id of [1n, 2n, 3n]) {
    await sender.queue(message(id), { save });
  }
  const pending = sender.pending();
  await receiver.receive(pending[3].request.data, { date: 203, save });
  const buffered = portable(receiver.exportState());
  assert.equal(buffered.incomingDates[0][1], 203);
  receiver = new SecretChatSession({ state: buffered });
  await receiver.receive(pending[3].request.data, { date: 999, save });
  const delivered = [];
  for (const index of [1, 0, 2]) {
    const output = await receiver.receive(pending[index].request.data, {
      date: 200 + index,
      save,
    });
    delivered.push(...output.messages);
  }
  assert.deepEqual(
    delivered.map((frame) => frame.date),
    [200, 201, 202, 203]
  );
  assert.deepEqual(receiver.exportState().incomingDates, []);
});

it('rolls back incoming date metadata and rejects invalid dates without aborting the chat', async () => {
  const sender = create();
  const receiver = create(false);
  await sender.queue(message(1n), { save });
  const packet = sender.pending()[1].request.data;
  const before = portable(receiver.exportState());
  for (const date of [-1, 0.5, null, '100', 0x80000000]) {
    await assert.rejects(receiver.receive(packet, { date, save }), /date/);
    assert.deepEqual(receiver.exportState(), before);
  }
  await assert.rejects(
    receiver.receive(packet, {
      date: 101,
      save: () => {
        throw new Error('gap date save failed');
      },
    }),
    /gap date save failed/
  );
  assert.deepEqual(receiver.exportState(), before);
  await receiver.receive(packet, { date: 101, save });
  assert.equal(receiver.exportState().incomingDates[0][1], 101);
});

it('validates bounded pending date snapshots and binds each date to its exact encrypted-message frame', async () => {
  const sender = create();
  const receiver = create(false);
  await sender.queue(message(1n), { save });
  await receiver.receive(sender.pending()[1].request.data, { date: 101, save });
  const original = portable(receiver.exportState());
  for (const change of [
    (state) => {
      state.incomingDates[0][1]++;
    },
    (state) => {
      state.incomingDates[0][0] += 2;
    },
    (state) => {
      state.incomingDates[0][2] = 'invalid';
    },
    (state) => {
      state.incomingDates.push([...state.incomingDates[0]]);
    },
    (state) => {
      state.incomingDates = null;
    },
  ]) {
    const state = portable(original);
    change(state);
    assert.throws(() => new SecretChatSession({ state }));
  }
  const previous = portable(original);
  delete previous.incomingDates;
  const restored = new SecretChatSession({ state: previous });
  const result = await restored.receive(sender.pending()[0].request.data, {
    date: 100,
    save,
  });
  assert.equal(result.messages[0].date, 100);
  assert.equal(result.messages[1].date, undefined);
});

it('derives incoming lifetime dates from ordered session effects committed before delivery', async () => {
  const sender = create();
  const receiver = create(false);
  await sender.queue(message(1n), { save });
  const pending = sender.pending();
  await receiver.receive(pending[1].request.data, { date: 101, save });
  let committed;
  const result = await receiver.receive(pending[0].request.data, {
    date: 100,
    save: (state, effects) => {
      assert.equal(state.sequence.incoming, 2);
      committed = effects.messages;
    },
  });
  assert.deepEqual(
    committed.map((frame) => frame.date),
    [100, 101]
  );
  assert.deepEqual(
    result.messages.map((frame) => frame.date),
    [100, 101]
  );
  const timers = new SecretChatLifetimes();
  timers.track(result.messages[1].message, {
    outgoing: false,
    date: result.messages[1].date,
    startOn: 'read',
  });
  assert.equal(
    timers.readThrough(101, { outgoing: false, at: 102 })[0].expiresAt,
    112
  );
});
