import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Context as OriginalContext } from 'telegraf';
import { TelegrafContext } from '../src/index.js';
import {
  telegrafWebhookBot,
  webhookInfo,
  webhookUpdate,
  telegrafWebhookResponse,
} from './fixtures/telegraf-webhook.js';

it('constructs a custom SDK context with the update, scoped Telegram API and bot info', async () => {
  for (const reference of [true, false]) {
    const Base = reference ? OriginalContext : TelegrafContext;
    class CustomContext extends Base {
      constructor(update, telegram, me) {
        super(update, telegram, me);
        this.constructorArgs = [update, telegram, me];
        this.custom = 'constructor';
      }
    }
    const { bot } = telegrafWebhookBot(reference, {
      contextType: CustomContext,
    });
    Object.assign(bot.context, { application: 'shared', custom: 'overlay' });
    let context;
    bot.use(async (ctx) => {
      context = ctx;
      await ctx.telegram.deleteMessage(7, 9);
    });
    const { response, snapshot } = telegrafWebhookResponse();
    await bot.handleUpdate(webhookUpdate, response);
    assert.ok(context instanceof CustomContext);
    assert.equal(context.application, 'shared');
    assert.equal(context.custom, 'overlay');
    assert.equal(context.constructorArgs[0], webhookUpdate);
    assert.equal(context.constructorArgs[1], context.telegram);
    assert.equal(context.constructorArgs[2], webhookInfo);
    assert.deepEqual(snapshot().body, {
      method: 'deleteMessage',
      chat_id: 7,
      message_id: 9,
    });
  }
});

it('initializes direct handleUpdate calls once and retries failed initialization', async () => {
  for (const reference of [true, false]) {
    const { bot, calls } = telegrafWebhookBot(reference);
    bot.botInfo = undefined;
    const seen = [];
    bot.use((ctx) => {
      seen.push(ctx.botInfo);
    });
    await Promise.all(
      [1, 2].map((update_id) => bot.handleUpdate({ update_id }))
    );
    assert.deepEqual(seen, [webhookInfo, webhookInfo]);
    assert.deepEqual(calls, [['getMe', {}]]);
  }
  const { bot } = telegrafWebhookBot(false);
  bot.botInfo = undefined;
  let attempts = 0;
  bot.api.getMe = async () => {
    if (++attempts === 1) {
      throw new Error('temporary');
    }
    return webhookInfo;
  };
  await assert.rejects(bot.handleUpdate({ update_id: 1 }), /temporary/);
  await bot.handleUpdate({ update_id: 1 });
  assert.equal(attempts, 2);
});

it('routes a finite handler timeout through the configured error handler and ends its response', async () => {
  for (const reference of [true, false]) {
    const { bot } = telegrafWebhookBot(reference, { handlerTimeout: 15 });
    let release;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    let caught;
    bot.use(() => pending);
    bot.catch((error, ctx) => {
      caught = { error, ctx };
    });
    const { response } = telegrafWebhookResponse();
    const guard = globalThis.setTimeout(release, 500);
    try {
      await bot.handleUpdate(webhookUpdate, response);
      assert.equal(caught?.error.name, 'TimeoutError');
      assert.equal(
        caught.error.message,
        'Promise timed out after 15 milliseconds'
      );
      assert.equal(caught.ctx.update, webhookUpdate);
      assert.equal(response.writableEnded, true);
    } finally {
      release();
      globalThis.clearTimeout(guard);
    }
  }
});

it('rejects invalid handler timeouts before running middleware', () => {
  for (const handlerTimeout of [-1, NaN, 2147483648]) {
    assert.throws(
      () => telegrafWebhookBot(false, { handlerTimeout }),
      /timeout/i
    );
  }
});
