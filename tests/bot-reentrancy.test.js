import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import {
  Bot,
  grammySession,
  telegrafSession,
  MemorySessionStore,
} from '../src/index.js';

const update = (id, text = '/start') => ({
  update_id: id,
  message: {
    message_id: id,
    text,
    chat: { id: 7 },
    from: { id: 8 },
    entities: [
      { type: 'bot_command', offset: 0, length: text.split(' ')[0].length },
    ],
  },
});
const bot = () =>
  new Bot('reentrant:test', { botInfo: { id: 1, username: 'testbot' } });

async function settles(task) {
  let timer;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timer = globalThis.setTimeout(
          () => reject(new Error('Nested update did not settle')),
          1000
        );
      }),
    ]);
  } finally {
    globalThis.clearTimeout(timer);
  }
}

it('awaits a restart-style nested update without waiting on its own queue', async () => {
  const instance = bot();
  const trace = [];
  instance.command('restart', async () => {
    trace.push('restart');
    await instance.handleUpdate(update(2));
    trace.push('restarted');
  });
  instance.command('start', () => trace.push('started'));
  await settles(instance.handleUpdate(update(1, '/restart')));
  assert.deepEqual(trace, ['restart', 'started', 'restarted']);
  assert(instance.seen.has(1));
  assert(instance.seen.has(2));
});

it('keeps unrelated updates queued while a nested update is running', async () => {
  const instance = bot();
  const trace = [];
  let entered, release;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const paused = new Promise((resolve) => {
    release = resolve;
  });
  instance.use(async (ctx) => {
    const id = ctx.update.update_id;
    trace.push(id);
    if (id === 1) {
      await instance.handleUpdate(update(2));
      trace.push('parent-finished');
    } else if (id === 2) {
      entered();
      await paused;
    }
  });
  const parent = instance.handleUpdate(update(1));
  try {
    await settles(ready);
    const unrelated = instance.handleUpdate(update(3));
    await turn();
    assert.deepEqual(trace, [1, 2]);
    release();
    await settles(Promise.all([parent, unrelated]));
    assert.deepEqual(trace, [1, 2, 'parent-finished', 3]);
  } finally {
    release();
  }
});

it('deduplicates an active ancestor update before entering its handler again', async () => {
  const instance = bot();
  let calls = 0;
  instance.use(async (ctx) => {
    if (++calls > 2) {
      throw new Error('Probe exceeded finite duplicate calls');
    }
    await instance.handleUpdate(ctx.update);
  });
  await settles(instance.handleUpdate(update(1)));
  assert.equal(calls, 1);
});

it('preserves a nested failure and releases the outer queue for later updates', async () => {
  const instance = bot();
  const reason = new Error('nested restart failed');
  const seen = [];
  instance.use(async (ctx) => {
    seen.push(ctx.update.update_id);
    if (ctx.update.update_id === 1) {
      await instance.handleUpdate(update(2));
    }
    if (ctx.update.update_id === 2) {
      throw reason;
    }
  });
  await assert.rejects(
    settles(instance.handleUpdate(update(1))),
    (error) => error === reason
  );
  assert.equal(instance.seen.has(1), false);
  assert.equal(instance.seen.has(2), false);
  await settles(instance.handleUpdate(update(3)));
  assert.deepEqual(seen, [1, 2, 3]);
});

it('routes nested errors to the registered catcher with the child context', async () => {
  const instance = bot();
  const errors = [];
  instance.catch((error) => errors.push(error.ctx.update.update_id));
  instance.use(async (ctx) => {
    if (ctx.update.update_id === 1) {
      await instance.handleUpdate(update(2));
    } else {
      throw new Error('child failed');
    }
  });
  await settles(instance.handleUpdate(update(1)));
  assert.deepEqual(errors, [2]);
  assert(instance.seen.has(1));
  assert(instance.seen.has(2));
});

it('rejects finite excessive nesting before the probe budget is reached', async () => {
  const instance = bot();
  let calls = 0;
  instance.use(async (ctx) => {
    if (++calls > 70) {
      throw new Error('Probe exceeded finite nesting');
    }
    await instance.handleUpdate(update(ctx.update.update_id + 1));
  });
  await assert.rejects(
    settles(instance.handleUpdate(update(1))),
    /nested.*depth limit/i
  );
  assert(calls <= 65);
  assert.equal(instance.seen.size, 0);
});

it('returns detached asynchronous descendants to the external update queue', async () => {
  const instance = bot();
  const trace = [];
  let releaseDelayed, releaseParent, delayed;
  const delayedReady = new Promise((resolve) => {
    releaseDelayed = resolve;
  });
  const parentReady = new Promise((resolve) => {
    releaseParent = resolve;
  });
  instance.use(async (ctx) => {
    const id = ctx.update.update_id;
    trace.push(id);
    if (id === 1) {
      delayed = delayedReady.then(() => instance.handleUpdate(update(3)));
    } else if (id === 2) {
      await parentReady;
    }
  });
  await settles(instance.handleUpdate(update(1)));
  const parent = instance.handleUpdate(update(2));
  try {
    await turn();
    releaseDelayed();
    await turn();
    assert.deepEqual(trace, [1, 2]);
  } finally {
    releaseParent();
  }
  await settles(Promise.all([parent, delayed]));
  assert.deepEqual(trace, [1, 2, 3]);
});

for (const [style, factory, defaults, key] of [
  ['grammy', grammySession, { initial: () => ({ count: 0 }) }, '7'],
  [
    'telegraf',
    telegrafSession,
    { defaultSession: () => ({ count: 0 }) },
    '8:7',
  ],
]) {
  it(`shares one ${style} session transaction across nested update contexts`, async () => {
    const instance = bot();
    const storage = new MemorySessionStore();
    instance.use(factory({ ...defaults, storage }));
    instance.use(async (ctx) => {
      if (ctx.update.update_id === 1) {
        ctx.session.count++;
        await instance.handleUpdate(update(2));
        assert.equal(ctx.session.count, 5);
        ctx.session.count++;
      } else {
        assert.equal(ctx.session.count, 1);
        ctx.session = { count: 5 };
      }
    });
    await settles(instance.handleUpdate(update(1)));
    assert.deepEqual(storage.read(key), { count: 6 });
  });

  it(`keeps ${style} failure persistence semantics across borrowed sessions`, async () => {
    const instance = bot();
    const storage = new MemorySessionStore();
    const reason = new Error('nested transaction failed');
    instance.use(factory({ ...defaults, storage, maxPending: 1 }));
    instance.use(async (ctx) => {
      ctx.session.count++;
      if (ctx.update.update_id === 1) {
        await instance.handleUpdate(update(2));
      } else {
        throw reason;
      }
    });
    await assert.rejects(
      settles(instance.handleUpdate(update(1))),
      (error) => error === reason
    );
    assert.deepEqual(
      storage.read(key),
      style === 'grammy' ? undefined : { count: 2 }
    );
  });

  it(`propagates nested ${style} session replacement and deletion through one property`, async () => {
    const instance = bot();
    const storage = new MemorySessionStore();
    instance.use(
      factory({
        ...defaults,
        storage,
        maxPending: 1,
        property: 'state',
        prefix: 'test:',
      })
    );
    instance.use(async (ctx) => {
      if (ctx.update.update_id === 1) {
        ctx.state = { replaced: true };
        await instance.handleUpdate(update(2));
        assert.equal(ctx.state, undefined);
      } else {
        assert.deepEqual(ctx.state, { replaced: true });
        ctx.state = undefined;
      }
    });
    await settles(instance.handleUpdate(update(1)));
    assert.equal(storage.read(`test:${key}`), undefined);
    assert.equal(storage.size, 0);
  });
}

it('borrows an active ancestor session through nested updates using a different key', async () => {
  const instance = bot();
  const storage = new MemorySessionStore();
  instance.use(grammySession({ storage, initial: () => ({ count: 0 }) }));
  instance.use(async (ctx) => {
    ctx.session.count++;
    if (ctx.update.update_id === 1) {
      const child = update(2);
      child.message.chat.id = 9;
      await instance.handleUpdate(child);
      assert.equal(ctx.session.count, 2);
    } else if (ctx.update.update_id === 2) {
      await instance.handleUpdate(update(3));
      assert.equal(ctx.session.count, 1);
    }
  });
  await settles(instance.handleUpdate(update(1)));
  assert.deepEqual(storage.read('7'), { count: 2 });
  assert.deepEqual(storage.read('9'), { count: 1 });
});
