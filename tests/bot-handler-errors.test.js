import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Telegraf as ReferenceTelegraf } from 'telegraf';
import { Bot, Telegraf, TelegramBot } from '../src/index.js';

const identity = { id: 1, is_bot: true, username: 'fixture_bot' };
const update = (id) => ({
  update_id: id,
  message: {
    message_id: id,
    chat: { id: 7, type: 'private' },
    from: { id: 8 },
    text: '/test',
  },
});
const instance = (Constructor = TelegramBot) =>
  new Constructor('errors:fixture', { botInfo: identity });

async function settled(task) {
  let watchdog;
  try {
    return await Promise.race([
      task,
      new Promise((resolve, reject) => {
        watchdog = globalThis.setTimeout(
          () => reject(new Error('Bot handler probe did not settle')),
          1000
        );
      }),
    ]);
  } finally {
    globalThis.clearTimeout(watchdog);
  }
}

it('matches actual Telegraf catch error and context identities', async () => {
  const reason = new Error('middleware failed');
  for (const Constructor of [ReferenceTelegraf, Telegraf]) {
    const bot = instance(Constructor);
    bot.botInfo = identity;
    let context, received;
    bot.use((ctx) => {
      context = ctx;
      throw reason;
    });
    assert.equal(
      bot.catch((error, ctx) => {
        received = { error, ctx };
      }),
      bot
    );
    await settled(bot.handleUpdate(update(1)));
    assert.equal(received.error, reason);
    assert.equal(received.ctx, context);
    assert.equal(received.ctx.update.update_id, 1);
  }
});

it('retains actual Telegraf async catcher results and primitive error values', async () => {
  for (const Constructor of [ReferenceTelegraf, Telegraf]) {
    const bot = instance(Constructor);
    bot.botInfo = identity;
    bot.use(() => {
      throw 'primitive failure';
    });
    bot.catch(async (error, ctx) => {
      await Promise.resolve();
      assert.equal(error, 'primitive failure');
      return { recovered: ctx.update.update_id };
    });
    assert.deepEqual(await settled(bot.handleUpdate(update(1))), {
      recovered: 1,
    });
  }
});

for (const event of ['message', 'text-pattern']) {
  it(`catches ${event} listener failures with the owning update context`, async () => {
    const bot = instance();
    const reason = new Error('listener failed');
    let received,
      calls = 0,
      middleware = 0;
    const listener = () => {
      calls++;
      throw reason;
    };
    if (event === 'message') {
      bot.on('message', listener);
    } else {
      bot.onText(/test/, listener);
    }
    bot.use(() => middleware++);
    bot.catch((error) => {
      received = error;
    });
    const value = update(1);
    await settled(bot.processUpdate(value));
    await settled(bot.processUpdate(value));
    assert.equal(calls, 1);
    assert.equal(middleware, 0);
    assert.equal(received.cause, reason);
    assert.equal(received.error, reason);
    assert.equal(received.ctx.update, value);
    assert.equal(received.ctx.api, bot.api);
    assert(bot.seen.has(1));
    assert.equal(bot.processing.size, 0);
  });
}

it('awaits an async event catcher before admitting the next queued update', async () => {
  const bot = instance();
  const trace = [];
  let entered, release;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const pause = new Promise((resolve) => {
    release = resolve;
  });
  bot.on('message', async (message) => {
    trace.push(message.message_id);
    if (message.message_id === 1) {
      throw new Error('async event failure');
    }
  });
  bot.catch(async (error) => {
    trace.push(`catch:${error.ctx.update.update_id}`);
    entered();
    await pause;
    trace.push('recovered');
  });
  const first = bot.processUpdate(update(1));
  // Observe early rejection while the original implementation misses the catcher.
  first.catch(() => {});
  let second;
  try {
    await settled(Promise.race([ready, first]));
    second = bot.processUpdate(update(2));
    await Promise.resolve();
    assert.deepEqual(trace, [1, 'catch:1']);
  } finally {
    release();
    await settled(Promise.all([first, second]));
  }
  assert.deepEqual(trace, [1, 'catch:1', 'recovered', 2]);
});

it('retains unhandled listener errors and allows a later retry without poisoning the queue', async () => {
  const bot = instance();
  const reason = new Error('unhandled event');
  const listener = () => {
    throw reason;
  };
  bot.on('message', listener);
  await assert.rejects(
    settled(bot.processUpdate(update(1))),
    (error) => error === reason
  );
  assert.equal(bot.seen.has(1), false);
  assert.equal(bot.processing.size, 0);
  bot.removeListener('message', listener);
  const delivered = [];
  bot.on('message', (message) => delivered.push(message.message_id));
  await settled(bot.processUpdate(update(1)));
  await settled(bot.processUpdate(update(2)));
  assert.deepEqual(delivered, [1, 2]);
});

it('preserves an event catcher rejection and keeps the failed update retryable', async () => {
  const bot = instance();
  const reason = new Error('catcher persistence failed');
  let caught = 0;
  bot.on('message', () => {
    throw new Error('event failed');
  });
  bot.catch(async () => {
    caught++;
    throw reason;
  });
  await assert.rejects(
    settled(bot.processUpdate(update(1))),
    (error) => error === reason
  );
  assert.equal(caught, 1);
  assert.equal(bot.seen.has(1), false);
  assert.equal(bot.processing.size, 0);
  bot.removeAllListeners();
  await settled(bot.processUpdate(update(2)));
  assert(bot.seen.has(2));
});

it('handles nested event failures once with the child context and preserves parent order', async () => {
  const bot = instance();
  const trace = [];
  bot.on('message', async (message) => {
    trace.push(message.message_id);
    if (message.message_id === 1) {
      await bot.processUpdate(update(2));
      trace.push('parent');
    } else {
      throw new Error('child failed');
    }
  });
  bot.catch((error) => trace.push(`catch:${error.ctx.update.update_id}`));
  await settled(bot.processUpdate(update(1)));
  assert.deepEqual(trace, [1, 2, 'catch:2', 'parent']);
  assert(bot.seen.has(1));
  assert(bot.seen.has(2));
  assert.equal(bot.processing.size, 0);
});

it('retains the shared Bot wrapped-error contract for middleware failures', async () => {
  const bot = instance(Bot);
  const reason = new Error('middleware failed');
  let received;
  bot.use(() => {
    throw reason;
  });
  bot.catch((error) => {
    received = error;
  });
  await bot.handleUpdate(update(1));
  assert.equal(received.error, reason);
  assert.equal(received.cause, reason);
  assert.equal(received.ctx.update.update_id, 1);
});

it('continues finite polling and advances offsets only after event recovery', async () => {
  const trace = [];
  let requests = 0;
  const bot = new TelegramBot('errors:fixture', {
    botInfo: identity,
    fetch: async (url, options) => {
      requests++;
      assert.match(url, /getUpdates$/);
      assert.equal(JSON.parse(options.body).offset, 0);
      return new Response(
        JSON.stringify({ ok: true, result: [update(1), update(2)] })
      );
    },
  });
  bot.on('message', async (message) => {
    trace.push(message.message_id);
    if (message.message_id === 1) {
      throw new Error('recoverable event');
    }
  });
  bot.catch(async ({ ctx }) => {
    assert.equal(bot.offset, 0);
    await Promise.resolve();
    trace.push(`recovered:${ctx.update.update_id}`);
  });
  await settled(bot.startPolling({ maxPolls: 1, timeout: 0 }));
  assert.deepEqual(trace, [1, 'recovered:1', 2]);
  assert.equal(requests, 1);
  assert.equal(bot.offset, 3);
  assert.equal(bot.isRunning(), false);
  assert(bot.seen.has(1) && bot.seen.has(2));
});
