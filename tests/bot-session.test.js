import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as anygram from '../src/index.js';
import { session as referenceGrammy } from 'grammy';
import { session as referenceTelegraf } from 'telegraf';

const context = (chat = 7, user = 8) => ({
  update: { update_id: 1 },
  chat: chat === undefined ? undefined : { id: chat },
  chatId: chat,
  from: user === undefined ? undefined : { id: user },
});

it('matches grammY and Telegraf keys, initialization and deletion with their actual middleware', async () => {
  for (const [native, reference, options, key] of [
    [
      anygram.grammySession,
      referenceGrammy,
      { initial: () => ({ count: 0 }) },
      '7',
    ],
    [
      anygram.telegrafSession,
      referenceTelegraf,
      { defaultSession: () => ({ count: 0 }) },
      '8:7',
    ],
  ]) {
    const traces = [];
    for (const factory of [native, reference]) {
      const trace = [];
      const values = new Map();
      const store = {
        async read(key) {
          trace.push(['read', key]);
          return values.get(key);
        },
        async write(key, value) {
          trace.push(['write', key, value.count]);
          values.set(key, value);
        },
        async delete(key) {
          trace.push(['delete', key]);
          values.delete(key);
        },
      };
      const middleware = factory({
        ...options,
        storage: store,
        store: { get: store.read, set: store.write, delete: store.delete },
      });
      await middleware(context(), async () => {});
      const first = context();
      await middleware(first, async () => {
        first.session.count++;
      });
      const second = context();
      await middleware(second, async () => {
        assert.equal(second.session.count, 1);
        second.session = undefined;
      });
      assert.equal(values.size, 0);
      assert(trace.some((entry) => entry[0] === 'write' && entry[1] === key));
      traces.push(trace);
    }
    assert.deepEqual(traces[0], traces[1]);
  }
});

it('serializes a shared key across middleware users and releases locks after failed handlers', async () => {
  const store = new anygram.MemorySessionStore();
  const middleware = anygram.session({
    storage: store,
    initial: () => ({ count: 0 }),
  });
  await Promise.all(
    Array.from({ length: 12 }, () => {
      const ctx = context();
      return middleware(ctx, async () => {
        const count = ctx.session.count;
        await Promise.resolve();
        ctx.session.count = count + 1;
      });
    })
  );
  assert.equal(store.read('7').count, 12);
  const failed = context();
  await assert.rejects(
    middleware(failed, async () => {
      failed.session.count = 99;
      throw new Error('handler failed');
    }),
    /handler failed/
  );
  const retried = context();
  await middleware(retried, async () => {
    retried.session.count++;
  });
  assert.equal(store.read('7').count, 13);
});

it('awaits persistent writes, preserves storage failures and skips missing keys', async () => {
  let saved;
  const middleware = anygram.session({
    initial: () => ({}),
    storage: {
      read: async () => undefined,
      write: async (key, value) => {
        await Promise.resolve();
        saved = { key, value };
        throw new Error('database unavailable');
      },
      delete: async () => {},
    },
  });
  const missing = { update: { update_id: 1 } };
  await middleware(missing, async () => {});
  assert.equal(saved, undefined);
  const ctx = context();
  await assert.rejects(
    middleware(ctx, async () => {
      ctx.session.answer = 42;
    }),
    /database unavailable/
  );
  assert.deepEqual(saved, { key: '7', value: { answer: 42 } });
});

it('bounds default memory storage and expires entries without a timer per key', () => {
  let now = 1;
  const store = new anygram.MemorySessionStore({
    maxEntries: 2,
    ttl: 10,
    now: () => now,
  });
  store.set('a', { value: 1 });
  store.set('b', { value: 2 });
  assert.equal(store.get('a').value, 1);
  store.set('c', { value: 3 });
  assert.equal(store.get('b'), undefined);
  assert.equal(store.size, 2);
  now = 11;
  assert.equal(store.get('a'), undefined);
  assert.equal(store.get('c'), undefined);
  assert.equal(store.size, 0);
  assert.throws(() => new anygram.MemorySessionStore({ ttl: '10' }), /TTL/);
});

it('preserves each framework’s handler-failure persistence policy against real middleware', async () => {
  for (const [native, reference, options, expected] of [
    [
      anygram.grammySession,
      referenceGrammy,
      { initial: () => ({ count: 0 }) },
      [],
    ],
    [
      anygram.telegrafSession,
      referenceTelegraf,
      { defaultSession: () => ({ count: 0 }) },
      [1],
    ],
  ]) {
    for (const factory of [native, reference]) {
      const writes = [];
      const write = async (key, value) => {
        writes.push(value.count);
      };
      const read = async () => undefined;
      const remove = async () => {};
      const middleware = factory({
        ...options,
        storage: { read, write, delete: remove },
        store: { get: read, set: write, delete: remove },
      });
      const ctx = context();
      await assert.rejects(
        middleware(ctx, async () => {
          ctx.session.count++;
          throw new Error('handler failure');
        }),
        /handler failure/
      );
      assert.deepEqual(writes, expected);
    }
  }
});
