import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { UpdateManager } from '../src/updates.js';
const message = (id, pts) => ({
  _: 'updateNewMessage',
  message: { _: 'message', id },
  pts,
  pts_count: 1,
});
describe('ordered update recovery', () => {
  it('recovers a common pts gap, emits missing events, and drops duplicates', async () => {
    const seen = [];
    const calls = [];
    const manager = new UpdateManager({
      state: { pts: 1, qts: 0, seq: 0, date: 1 },
      invoke: async (method, params) => {
        calls.push(method);
        assert.equal(params.pts, 1);
        return {
          _: 'updates.difference',
          new_messages: [{ _: 'message', id: 2 }],
          new_encrypted_messages: [],
          other_updates: [],
          state: { pts: 2, qts: 0, seq: 0, date: 2 },
        };
      },
      onUpdate: (u) => seen.push(u.message.id),
    });
    await manager.feed({ _: 'updateShort', update: message(3, 3), date: 3 });
    await manager.feed({ _: 'updateShort', update: message(3, 3), date: 3 });
    assert.deepEqual(calls, ['updates.getDifference']);
    assert.deepEqual(seen, [2, 3]);
    assert.equal(manager.state.pts, 3);
  });
  it('isolates channel pts and recovers a channel gap without global polling per channel', async () => {
    const seen = [];
    const calls = [];
    const manager = new UpdateManager({
      state: {
        pts: 5,
        qts: 0,
        seq: 0,
        date: 1,
        channels: { 42: { pts: 10, access_hash: 7n } },
      },
      invoke: async (method, params) => {
        calls.push(method);
        assert.equal(params.channel.channel_id, 42n);
        return {
          _: 'updates.channelDifference',
          pts: 11,
          final: true,
          new_messages: [
            {
              _: 'message',
              id: 11,
              peer_id: { _: 'peerChannel', channel_id: 42n },
            },
          ],
          other_updates: [],
          users: [],
          chats: [],
        };
      },
      onUpdate: (u) => seen.push(u.message.id),
    });
    await manager.feed({
      _: 'updateShort',
      update: {
        _: 'updateNewChannelMessage',
        message: { id: 12, peer_id: { _: 'peerChannel', channel_id: 42n } },
        pts: 12,
        pts_count: 1,
      },
      date: 2,
    });
    assert.deepEqual(calls, ['updates.getChannelDifference']);
    assert.deepEqual(seen, [11, 12]);
    assert.equal(manager.state.pts, 5);
    assert.equal(manager.state.channels['42'].pts, 12);
  });
  it('keeps failed handlers retryable and serializes concurrent delivery', async () => {
    let fail = true;
    const seen = [];
    const manager = new UpdateManager({
      state: { pts: 1, qts: 0, seq: 0, date: 1 },
      invoke: () => assert.fail(),
      onUpdate: async (u) => {
        if (fail) {
          fail = false;
          throw new Error('storage unavailable');
        }
        await Promise.resolve();
        seen.push(u.message.id);
      },
    });
    await assert.rejects(
      manager.feed({ _: 'updateShort', update: message(2, 2), date: 2 }),
      /storage unavailable/
    );
    assert.equal(manager.state.pts, 1);
    await Promise.all([
      manager.feed({ _: 'updateShort', update: message(2, 2), date: 2 }),
      manager.feed({ _: 'updateShort', update: message(3, 3), date: 3 }),
    ]);
    assert.deepEqual(seen, [2, 3]);
    assert.equal(manager.state.pts, 3);
  });
  it('advances qts only after processing and acknowledges the secondary sequence', async () => {
    const calls = [];
    const manager = new UpdateManager({
      state: { pts: 0, qts: 4, seq: 0, date: 1 },
      invoke: async (method, p) => {
        calls.push([method, p]);
        return true;
      },
      onUpdate: async () => {},
    });
    await manager.feed({
      _: 'updateShort',
      update: {
        _: 'updateNewEncryptedMessage',
        qts: 5,
        message: { random_id: 1n },
      },
      date: 2,
    });
    assert.equal(manager.state.qts, 5);
    assert.deepEqual(calls, [['messages.receivedQueue', { max_qts: 5 }]]);
  });
});
it('rolls back the cursor when durable state persistence fails', async () => {
  let fail = true;
  const manager = new UpdateManager({
    state: { pts: 1, qts: 0, seq: 0, date: 1 },
    invoke: () => assert.fail(),
    onState: () => {
      if (fail) {
        fail = false;
        throw new Error('disk full');
      }
    },
  });
  await assert.rejects(
    manager.feed({ _: 'updateShort', update: message(2, 2) }),
    /disk full/
  );
  assert.equal(manager.state.pts, 1);
  await manager.feed({ _: 'updateShort', update: message(2, 2) });
  assert.equal(manager.state.pts, 2);
});
it('tracks channel differences when a response refreshes the channel entity', async () => {
  const manager = new UpdateManager({
    state: { pts: 0, date: 1, channels: { 42: { pts: 1, access_hash: 5n } } },
    invoke: async () => ({
      _: 'updates.channelDifference',
      pts: 2,
      final: true,
      new_messages: [],
      other_updates: [],
      chats: [{ _: 'channel', id: 42n, access_hash: 5n }],
    }),
  });
  await manager.feed({
    _: 'updateShort',
    update: {
      _: 'updateNewChannelMessage',
      message: { peer_id: { channel_id: 42n } },
      pts: 3,
      pts_count: 1,
    },
  });
  assert.equal(manager.state.channels[42].pts, 3);
});
it('bounds cyclic channel recovery hints and preserves the cursor on failure', async () => {
  let calls = 0;
  const manager = new UpdateManager({
    state: { date: 1, channels: { 42: { pts: 1, access_hash: 5n } } },
    invoke: async () => {
      calls++;
      assert.ok(calls <= 3, 'recovery recursion exceeded finite probe bound');
      return {
        _: 'updates.channelDifference',
        pts: 2,
        final: true,
        other_updates: [{ _: 'updateChannelTooLong', channel_id: 42n }],
      };
    },
  });
  await assert.rejects(manager.recoverChannel(42n), /Cyclic channel recovery/);
  assert.equal(calls, 1);
  assert.equal(manager.state.channels[42].pts, 1);
});
it('delivers a live read receipt omitted by a difference that advances past it (gotd #1853)', async () => {
  const seen = [];
  const manager = new UpdateManager({
    state: { pts: 100, date: 1 },
    invoke: async () => ({
      _: 'updates.difference',
      other_updates: [],
      state: { pts: 130, qts: 0, seq: 1, date: 2 },
    }),
    onUpdate: (update) => seen.push(update.max_id),
  });
  const receipt = {
    _: 'updateReadHistoryOutbox',
    peer: { _: 'peerUser', user_id: 7n },
    max_id: 42,
    pts: 106,
    pts_count: 1,
  };
  await manager.feed({ _: 'updateShort', update: receipt });
  await manager.feed({ _: 'updateShort', update: receipt });
  assert.deepEqual(seen, [42]);
  assert.equal(manager.state.pts, 130);
});
it('delivers a difference replay once and preserves distinct receipts at the same pts', async () => {
  const first = {
    _: 'updateReadHistoryOutbox',
    peer: { _: 'peerUser', user_id: 7n },
    max_id: 42,
    pts: 106,
    pts_count: 1,
  };
  const second = { ...first, peer: { _: 'peerUser', user_id: 8n } };
  const seen = [];
  const manager = new UpdateManager({
    state: { pts: 100, date: 1 },
    invoke: async () => ({
      _: 'updates.difference',
      other_updates: [first],
      state: { pts: 130, qts: 0, seq: 1, date: 2 },
    }),
    onUpdate: (u) => seen.push(u.peer.user_id),
  });
  await manager.feed({ _: 'updateShort', update: second });
  assert.deepEqual(seen, [8n, 7n]);
  const replayed = [];
  const another = new UpdateManager({
    state: { pts: 100, date: 1 },
    invoke: manager.invoke,
    onUpdate: (u) => replayed.push(u),
  });
  await another.feed({ _: 'updateShort', update: first });
  assert.equal(replayed.length, 1);
});
it('preserves a live channel event when an empty difference advances its cursor', async () => {
  const seen = [];
  const manager = new UpdateManager({
    state: { date: 1, channels: { 42: { pts: 1, access_hash: 5n } } },
    invoke: async () => ({
      _: 'updates.channelDifferenceEmpty',
      pts: 7,
      final: true,
    }),
    onUpdate: (u) => seen.push(u.max_id),
  });
  await manager.feed({
    _: 'updateShort',
    update: {
      _: 'updateReadChannelOutbox',
      channel_id: 42n,
      max_id: 50,
      pts: 5,
      pts_count: 0,
    },
  });
  assert.deepEqual(seen, [50]);
});
it('delivers zero-count events once when recovery ends at their exact cursor', async () => {
  const seen = [];
  const manager = new UpdateManager({
    state: { pts: 1, date: 1 },
    invoke: async () => ({
      _: 'updates.difference',
      other_updates: [],
      state: { pts: 5, date: 2 },
    }),
    onUpdate: (u) => seen.push(u.max_id),
  });
  await manager.feed({
    _: 'updateShort',
    update: {
      _: 'updateReadHistoryOutbox',
      max_id: 50,
      pts: 5,
      pts_count: 0,
    },
  });
  assert.deepEqual(seen, [50]);
});
