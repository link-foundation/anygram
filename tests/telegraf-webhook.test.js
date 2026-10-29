import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import process from 'node:process';
import {
  webhookInfo,
  plainWebhookCalls,
  telegrafWebhookBot,
  telegrafWebhookScenario,
  telegrafWebhookRequest,
  telegrafWebhookResponse,
} from './fixtures/telegraf-webhook.js';

for (const form of ['object', 'string', 'buffer', 'stream']) {
  for (const reply of [false, true]) {
    it(`matches actual Telegraf callback ${form} body with reply ${reply}`, async () => {
      const options = { form, reply };
      assert.deepEqual(
        await telegrafWebhookScenario(false, options),
        await telegrafWebhookScenario(true, options)
      );
    });
  }
}

for (const [reason, request] of Object.entries({
  method: { method: 'GET' },
  path: { url: '/other' },
  secret: { headers: { 'x-telegram-bot-api-secret-token': 'wrong' } },
  missing: { headers: {} },
})) {
  for (const next of [false, true]) {
    it(`matches actual Telegraf ${reason} filter with next ${next}`, async () => {
      const options = { request, next };
      assert.deepEqual(
        await telegrafWebhookScenario(false, options),
        await telegrafWebhookScenario(true, options)
      );
    });
  }
}

for (const body of ['{', Buffer.from('{')]) {
  it(`matches actual Telegraf malformed ${typeof body} preparsed JSON response`, async () => {
    const options = { request: { body } };
    assert.deepEqual(
      await telegrafWebhookScenario(false, options),
      await telegrafWebhookScenario(true, options)
    );
  });
}

it('binds custom Telegraf filters to path and secret options like the actual SDK', async () => {
  const options = {
    customFilter: true,
    request: { method: 'GET', url: '/other' },
  };
  assert.deepEqual(
    await telegrafWebhookScenario(false, options),
    await telegrafWebhookScenario(true, options)
  );
});

for (const replyFlag of [false, true]) {
  it(`preserves the actual Telegraf bot webhookReply alias ${replyFlag}`, async () => {
    const options = { replyFlag };
    assert.deepEqual(
      await telegrafWebhookScenario(false, options),
      await telegrafWebhookScenario(true, options)
    );
  });
}

for (const domain of [
  'example.org',
  'http://example.org:8443/base',
  'https://example.org/base',
]) {
  it(`matches actual Telegraf createWebhook URL and payload for ${domain}`, async () => {
    const probe = async (reference) => {
      const { bot, calls } = telegrafWebhookBot(reference);
      const callback = await bot.createWebhook({
        domain,
        path: '/hook',
        secret_token: 'secret',
        drop_pending_updates: true,
        allowed_updates: ['message'],
        max_connections: 12,
        ip_address: '127.0.0.1',
      });
      const { response, snapshot } = telegrafWebhookResponse();
      await callback(telegrafWebhookRequest(), response);
      return plainWebhookCalls({ calls, ...snapshot() });
    };
    assert.deepEqual(await probe(false), await probe(true));
  });
}

it('matches actual Telegraf secret path generation and default webhook path', async () => {
  const expected = createHash('sha3-256')
    .update('123:webhook')
    .update(process.version)
    .digest('hex');
  for (const reference of [true, false]) {
    const { bot, calls } = telegrafWebhookBot(reference);
    assert.equal(bot.secretPathComponent(), expected);
    const callback = await bot.createWebhook({ domain: 'example.org' });
    assert.deepEqual(calls, [
      ['setWebhook', { url: `https://example.org/telegraf/${expected}` }],
    ]);
    const { response, snapshot } = telegrafWebhookResponse();
    await callback(
      telegrafWebhookRequest('object', {
        url: `/telegraf/${expected}`,
        headers: {},
      }),
      response
    );
    assert.equal(snapshot().status, 200);
    assert.equal(snapshot().ended, true);
  }
});

it('preserves a createWebhook registration failure without swallowing or replaying it', async () => {
  const failure = new Error('registration failed');
  for (const reference of [true, false]) {
    const { bot } = telegrafWebhookBot(reference);
    let attempts = 0;
    bot.telegram.setWebhook = async () => {
      attempts++;
      throw failure;
    };
    await assert.rejects(
      bot.createWebhook({ domain: 'example.org', path: '/hook' }),
      failure
    );
    assert.equal(attempts, 1);
  }
});

it('initializes missing Telegraf bot information once across concurrent callbacks', async () => {
  for (const reference of [true, false]) {
    const { bot, calls } = telegrafWebhookBot(reference);
    bot.botInfo = undefined;
    const seen = [];
    bot.use((ctx) => {
      seen.push(ctx.botInfo);
    });
    const callback = bot.webhookCallback('/hook');
    await Promise.all(
      [1, 2].map((update_id) =>
        callback(
          telegrafWebhookRequest('object', { body: { update_id } }),
          telegrafWebhookResponse().response
        )
      )
    );
    assert.deepEqual(seen, [webhookInfo, webhookInfo]);
    assert.deepEqual(calls, [['getMe', {}]]);
  }
});
