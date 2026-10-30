import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { telegrafWebhookBot } from './fixtures/telegraf-webhook.js';
import {
  telegrafServerScenario,
  closeTelegrafServer,
  telegrafStartupStage,
} from './fixtures/telegraf-server.js';

for (const tls of [false, true]) {
  for (const kind of ['reply', 'forbidden', 'fallback', 'malformed']) {
    it(`matches actual Telegraf ${tls ? 'TLS' : 'HTTP'} launch and ${kind} handling`, async () => {
      assert.deepEqual(
        await telegrafServerScenario(false, tls, kind),
        await telegrafServerScenario(true, tls, kind)
      );
    });
  }
}

it('rolls back a listening server when Telegram registration fails and permits retry', async () => {
  const { bot } = telegrafWebhookBot(false);
  const failure = new Error('registration failed');
  bot.telegram.setWebhook = async () => {
    throw failure;
  };
  const options = {
    maxPolls: 0,
    webhook: {
      domain: 'example.org',
      path: '/hook',
      host: '127.0.0.1',
      port: 0,
    },
  };
  try {
    await assert.rejects(bot.launch(options), failure);
    assert.equal(bot.webhookServer?.listening ?? false, false);
    assert.equal(bot.isRunning(), false);
    bot.telegram.setWebhook = async () => true;
    await bot.launch(options);
    assert.equal(bot.webhookServer.listening, true);
    assert.equal(bot.isRunning(), true);
    await assert.rejects(bot.launch(options), /running/);
  } finally {
    await closeTelegrafServer(bot);
  }
  assert.equal(bot.isRunning(), false);
});

it('propagates a bind failure before registering and does not close another server', async () => {
  const occupied = createServer();
  occupied.listen(0, '127.0.0.1');
  await once(occupied, 'listening');
  const { bot, calls } = telegrafWebhookBot(false);
  try {
    await assert.rejects(
      bot.launch({
        maxPolls: 0,
        webhook: {
          domain: 'example.org',
          host: '127.0.0.1',
          port: occupied.address().port,
        },
      }),
      { code: 'EADDRINUSE' }
    );
    assert.deepEqual(calls, []);
    assert.equal(occupied.listening, true);
    assert.equal(bot.isRunning(), false);
  } finally {
    await closeTelegrafServer(bot);
    await new Promise((resolve) => occupied.close(resolve));
  }
});

it('normalizes Telegraf polling launch options while preserving bounded owned controls', async () => {
  const { bot, calls } = telegrafWebhookBot(false);
  let launched = 0;
  bot.api.callApi = async (method, params) => {
    calls.push([method, params]);
    return [];
  };
  await bot.launch(
    {
      maxPolls: 1,
      timeout: 0,
      dropPendingUpdates: true,
      allowedUpdates: ['message'],
    },
    () => {
      launched++;
    }
  );
  assert.equal(launched, 1);
  assert.deepEqual(calls, [
    ['deleteWebhook', { drop_pending_updates: true }],
    ['getUpdates', { offset: 0, timeout: 0, allowed_updates: ['message'] }],
  ]);
  assert.equal(bot.isRunning(), false);
});

it('accepts a launch callback as its first argument and lets it stop startup', async () => {
  const { bot, calls } = telegrafWebhookBot(false);
  let launched = 0;
  await bot.launch(() => {
    launched++;
    bot.stop();
  });
  assert.equal(launched, 1);
  assert.deepEqual(calls, []);
  assert.equal(bot.isRunning(), false);
});

it('cleans startup state after invalid TLS settings without registering', async () => {
  const { bot, calls } = telegrafWebhookBot(false);
  await assert.rejects(
    bot.launch({
      maxPolls: 0,
      webhook: {
        domain: 'example.org',
        host: '127.0.0.1',
        port: 0,
        tlsOptions: { key: 'invalid', cert: 'invalid' },
      },
    })
  );
  assert.equal(bot.isRunning(), false);
  assert.deepEqual(calls, []);
});

it('prevents a stopped or concurrent initialization from opening a webhook server', async () => {
  const { bot, calls } = telegrafWebhookBot(false);
  bot.botInfo = undefined;
  let ready;
  const started = new Promise((resolve) => {
    ready = resolve;
  });
  let finish;
  const initialized = new Promise((resolve) => {
    finish = resolve;
  });
  bot.api.getMe = () => {
    ready();
    return initialized;
  };
  const options = {
    maxPolls: 0,
    webhook: { domain: 'example.org', host: '127.0.0.1', port: 0 },
  };
  const launch = bot.launch(options);
  try {
    await telegrafStartupStage(started);
    await assert.rejects(bot.launch(options), /running/);
    bot.stop();
  } finally {
    finish({ id: 123 });
    await launch;
  }
  assert.equal(bot.isRunning(), false);
  assert.equal(bot.webhookServer, undefined);
  assert.deepEqual(calls, []);
});

it('closes a server stopped during pending registration and finishes without restarting it', async () => {
  const { bot } = telegrafWebhookBot(false);
  let registered;
  const started = new Promise((resolve) => {
    registered = resolve;
  });
  let finish;
  const registration = new Promise((resolve) => {
    finish = resolve;
  });
  bot.telegram.setWebhook = () => {
    registered();
    return registration;
  };
  const launch = bot.launch({
    maxPolls: 0,
    webhook: { domain: 'example.org', host: '127.0.0.1', port: 0 },
  });
  let server;
  try {
    await telegrafStartupStage(started);
    server = bot.webhookServer;
    const closed = once(server, 'close');
    bot.stop();
    await closed;
  } finally {
    finish(true);
    await launch;
  }
  assert.equal(server.listening, false);
  assert.equal(bot.isRunning(), false);
});
