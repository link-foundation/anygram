import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { UpdateManager } from '../src/updates.js';

it('polls only explicitly watched channels with one clock and honors server timeouts (gotd #1800)', async () => {
  let now = 0;
  const calls = [];
  const channels = Object.fromEntries(
    Array.from({ length: 11 }, (_, i) => [
      i + 1,
      {
        pts: 1,
        access_hash: 2n,
      },
    ])
  );
  const manager = new UpdateManager({
    state: { date: 1, channels },
    clock: () => now,
    invoke: async (method, params) => {
      assert.equal(method, 'updates.getChannelDifference');
      calls.push(params.channel.channel_id);
      return {
        _: 'updates.channelDifferenceEmpty',
        pts: 1,
        final: true,
        timeout: 2,
      };
    },
  });
  for (let id = 1; id <= 10; id++) {
    manager.watchChannel(BigInt(id));
  }
  assert.throws(() => manager.watchChannel(11n), /watch.*limit/i);
  await manager.tick();
  assert.equal(calls.length, 10);
  now = 1999;
  await manager.tick();
  assert.equal(calls.length, 10);
  now = 2000;
  await Promise.all([manager.tick(), manager.tick()]);
  assert.equal(calls.length, 20);
  manager.unwatchChannel(10n);
  manager.watchChannel(11n);
  await manager.tick();
  assert.equal(calls.at(-1), 11n);
  assert.equal(calls.length, 21);
});

it('recovers common state after fifteen minutes without pushes, without per-channel timers', async () => {
  let now = 0;
  let calls = 0;
  const manager = new UpdateManager({
    state: { pts: 1, date: 1 },
    clock: () => now,
    invoke: async (method) => {
      assert.equal(method, 'updates.getDifference');
      calls++;
      return { _: 'updates.differenceEmpty', date: 2, seq: 0 };
    },
  });
  now = 899999;
  await manager.tick();
  assert.equal(calls, 0);
  now++;
  await manager.tick();
  await manager.tick();
  assert.equal(calls, 1);
  now = 1000000;
  await manager.feed({ _: 'updateUserStatus', user_id: 1n });
  now = 1800000;
  await manager.tick();
  assert.equal(calls, 1);
  now = 1900000;
  await manager.tick();
  assert.equal(calls, 2);
});

it('keeps failed scheduled recovery retryable and validates watched IDs', async () => {
  let calls = 0;
  const manager = new UpdateManager({
    state: { date: 1, channels: { 1: { pts: 1, access_hash: 2n } } },
    invoke: async () => {
      if (++calls === 1) {
        throw new Error('offline');
      }
      return { _: 'updates.channelDifferenceEmpty', pts: 1, final: true };
    },
  });
  for (const id of [0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1, 'wrong']) {
    assert.throws(() => manager.watchChannel(id), /channel/i);
  }
  manager.watchChannel(1n);
  await assert.rejects(manager.tick(), /offline/);
  await manager.tick();
  assert.equal(calls, 2);
});
