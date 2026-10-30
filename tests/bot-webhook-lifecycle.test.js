import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { webhookCallback as originalWebhook } from 'grammy';
import { Bot, Telegraf, webhookCallback } from '../src/index.js';
import { frameworkScenario } from './fixtures/webhook-framework.js';

function deferred() {
  let resolve;
  const promise = new Promise((finish) => {
    resolve = finish;
  });
  return { promise, resolve };
}

function customHook(handleUpdate, init = async () => {}) {
  const calls = [];
  const bot = { isRunning: () => false, init, handleUpdate };
  const adapter = (update, header) => ({
    get update() {
      calls.push('read');
      return update;
    },
    header,
    respond(body) {
      calls.push(['reply', body]);
    },
    end() {
      calls.push('end');
    },
    unauthorized() {
      calls.push('unauthorized');
    },
  });
  return { bot, adapter, calls };
}

it('continues to accept native Fetch requests without an adapter argument', async () => {
  const bot = new Bot('123:webhook', {
    client: { canUseWebhookReply: () => true },
  });
  bot.use((ctx) => ctx.api.sendMessage(7, 'Fetch'));
  const response = await webhookCallback(bot)(
    new globalThis.Request('http://localhost/webhook', {
      method: 'POST',
      body: JSON.stringify({ update_id: 1 }),
    })
  );
  assert.equal((await response.json()).text, 'Fetch');
});

it('bounds preparsed framework updates before middleware dispatch', async () => {
  const bot = new Bot('123:webhook', { botInfo: { id: 123 } });
  let handled = false;
  bot.use(() => {
    handled = true;
  });
  const callback = webhookCallback(bot, 'express', { maxBytes: 16 });
  await assert.rejects(
    callback(
      { body: { update_id: 1, text: 'x'.repeat(32) }, header: () => undefined },
      { end() {} }
    ),
    /Webhook body exceeds byte limit/
  );
  assert.equal(handled, false);
});

for (const mode of ['reply', 'empty', 'unauthorized']) {
  it(`preserves actual grammY default Express ${mode} while accepting Fetch requests`, async () => {
    for (const positionalOptions of [false, true]) {
      const options = { defaultAdapter: true, positionalOptions };
      assert.deepEqual(
        await frameworkScenario('express', false, mode, options),
        await frameworkScenario('express', true, mode, options)
      );
    }
  });
}

it('matches actual grammY custom adapter dispatch and authentication', async () => {
  const probe = async (reference) => {
    const hook = customHook(async (update, envelope) =>
      envelope.send(JSON.stringify(update))
    );
    const callback = (reference ? originalWebhook : webhookCallback)(
      hook.bot,
      hook.adapter,
      { secretToken: 'secret' }
    );
    await callback({ update_id: 1 }, 'wrong');
    await callback({ update_id: 2 }, 'secret');
    return hook.calls;
  };
  assert.deepEqual(await probe(false), await probe(true));
});

it('deduplicates concurrent webhook initialization and retries a failed initialization', async () => {
  const ready = deferred();
  let attempts = 0;
  const failure = new Error('initialization failed');
  const hook = customHook(
    async () => {},
    async () => {
      attempts++;
      if (attempts === 1) {
        throw failure;
      }
      await ready.promise;
    }
  );
  const callback = webhookCallback(hook.bot, hook.adapter);
  await assert.rejects(callback({ update_id: 1 }), failure);
  const tasks = [callback({ update_id: 2 }), callback({ update_id: 3 })];
  ready.resolve();
  await Promise.all(tasks);
  assert.equal(attempts, 2);
  assert.deepEqual(hook.calls, ['read', 'read', 'end', 'end']);
});

it('propagates handler and sender errors without ending or replaying the response', async () => {
  for (const phase of ['handler', 'sender']) {
    const failure = new Error(phase);
    const hook = customHook(async (update, envelope) => {
      if (phase === 'handler') {
        throw failure;
      }
      await envelope.send('JSON');
    });
    if (phase === 'sender') {
      hook.adapter = () => ({
        update: { update_id: 1 },
        respond() {
          throw failure;
        },
      });
    }
    await assert.rejects(
      webhookCallback(hook.bot, hook.adapter)({ update_id: 1 }),
      failure
    );
    assert.ok(!hook.calls.includes('end'));
  }
});

for (const strategy of ['throw', 'return', 'function']) {
  it(`owns timeout ${strategy} and prevents a late second response`, async () => {
    const ready = deferred();
    const finished = deferred();
    let lateError;
    const hook = customHook(async (update, envelope) => {
      try {
        await ready.promise;
        await envelope.send('late');
      } catch (error) {
        lateError = error;
      } finally {
        finished.resolve();
      }
    });
    const timed = [];
    const callback = webhookCallback(hook.bot, hook.adapter, {
      timeoutMilliseconds: 0,
      onTimeout:
        strategy === 'function' ? (...args) => timed.push(args) : strategy,
    });
    try {
      const task = callback({ update_id: 1 }, 'header');
      if (strategy === 'throw') {
        await assert.rejects(task, /Request timed out after 0 ms/);
      } else {
        await task;
      }
    } finally {
      ready.resolve();
      await finished.promise;
    }
    assert.match(lateError.message, /ownership ended/);
    assert.equal(
      hook.calls.filter((call) => call === 'end').length,
      strategy === 'throw' ? 0 : 1
    );
    assert.equal(timed.length, strategy === 'function' ? 1 : 0);
    if (timed.length) {
      assert.deepEqual(timed[0], [{ update_id: 1 }, 'header']);
    }
  });
}

it('includes unfinished Node request bodies in the deadline and releases listeners', async () => {
  const request = Object.assign(new EventEmitter(), { headers: {} });
  let ended = 0;
  const response = {
    end() {
      ended++;
    },
  };
  const bot = new Bot('123:webhook', { botInfo: { id: 123 } });
  await webhookCallback(bot, 'http', {
    timeoutMilliseconds: 0,
    onTimeout: 'return',
  })(request, response);
  assert.equal(ended, 1);
  for (const event of ['data', 'end', 'error']) {
    assert.equal(request.listenerCount(event), 0);
  }
});

it('cancels an unfinished Fetch request body after its deadline', async () => {
  let cancelled = 0;
  const body = new globalThis.ReadableStream({
    cancel() {
      cancelled++;
    },
  });
  const request = new globalThis.Request('http://localhost/webhook', {
    method: 'POST',
    body,
    duplex: 'half',
  });
  const bot = new Bot('123:webhook', { botInfo: { id: 123 } });
  const response = await webhookCallback(bot, 'bun', {
    timeoutMilliseconds: 0,
    onTimeout: 'return',
  })(request);
  assert.equal(response.status, 200);
  assert.equal(cancelled, 1);
});

it('rejects inherited adapter names and invalid timeout/body controls before dispatch', () => {
  const bot = new Bot('123:webhook');
  for (const name of ['__proto__', 'toString', 'missing']) {
    assert.throws(() => webhookCallback(bot, name), /Unknown webhook adapter/);
  }
  for (const timeoutMilliseconds of [-1, NaN, -Infinity, 2147483648]) {
    assert.throws(
      () => webhookCallback(bot, 'callback', { timeoutMilliseconds }),
      /Invalid webhook timeout/
    );
  }
  assert.throws(
    () => webhookCallback(bot, 'callback', { maxBytes: -1 }),
    /maxBytes/
  );
  assert.throws(
    () => webhookCallback(bot, 'callback', { onTimeout: 'invalid' }),
    /Invalid webhook timeout strategy/
  );
});

it('includes initialization in the response deadline and does not dispatch after expiry', async () => {
  const ready = deferred();
  const initialized = deferred();
  let handled = 0;
  const hook = customHook(
    async () => {
      handled++;
    },
    async () => {
      await ready.promise;
      initialized.resolve();
    }
  );
  const callback = webhookCallback(hook.bot, hook.adapter, {
    onTimeout: 'return',
    timeoutMilliseconds: 0,
  });
  // The independent finite guard exposes an unbounded initialization phase.
  let guard;
  try {
    await Promise.race([
      callback({ update_id: 1 }),
      new Promise((resolve, reject) => {
        guard = globalThis.setTimeout(
          () => reject(new Error('Initialization escaped webhook deadline')),
          200
        );
      }),
    ]);
  } finally {
    globalThis.clearTimeout(guard);
    ready.resolve();
    await initialized.promise;
  }
  await Promise.resolve();
  assert.equal(handled, 0);
  assert.deepEqual(hook.calls, ['end']);
});

it('preserves Telegraf start-command registration while blocking webhook polling conflicts', async () => {
  const bot = new Telegraf('123:webhook', {
    botInfo: { id: 123, username: 'bot' },
  });
  const callback = webhookCallback(bot, 'callback');
  let handled = 0;
  bot.start(() => {
    handled++;
  });
  await callback(
    {
      update_id: 1,
      message: {
        message_id: 9,
        date: 1,
        chat: { id: 7 },
        text: '/start',
        entities: [{ type: 'bot_command', offset: 0, length: 6 }],
      },
    },
    () => {}
  );
  assert.equal(handled, 1);
  await assert.rejects(bot.launch({ maxPolls: 0 }), /webhooks/);
});
