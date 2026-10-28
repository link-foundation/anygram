import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Bot, TelegramBot, webhookCallback } from '../src/index.js';
const update = (id, text = '/start') => ({
  update_id: id,
  message: {
    message_id: id,
    text,
    chat: { id: 77 },
    from: { id: 88 },
    entities: [{ type: 'bot_command', offset: 0, length: 6 }],
  },
});
const fakeFetch = async () =>
  new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }));
describe('shared bot dispatch', () => {
  it('runs grammY middleware, commands and context replies exactly once', async () => {
    const calls = [];
    const bot = new Bot('123:test', {
      fetch: async (url, opts) => {
        calls.push(JSON.parse(opts.body));
        return fakeFetch();
      },
    });
    const order = [];
    bot.use(async (ctx, next) => {
      order.push('before');
      await next();
      order.push('after');
    });
    bot.command('start', async (ctx) => {
      assert.equal(ctx.chat.id, 77);
      await ctx.reply('Started');
    });
    await bot.handleUpdate(update(1));
    await bot.handleUpdate(update(1));
    assert.deepEqual(order, ['before', 'after']);
    assert.deepEqual(calls, [{ chat_id: 77, text: 'Started' }]);
  });
  it('supports legacy event, once and onText callbacks for community-posts', async () => {
    const bot = new TelegramBot('123:test', { fetch: fakeFetch });
    const events = [];
    bot.onText(/^\/start$/, (message, match) => {
      events.push([message.chat.id, match[0]]);
    });
    bot.once('message', (message) => events.push(message.message_id));
    bot.on('callback_query', (query) => events.push(query.id));
    await bot.handleUpdate(update(1));
    await bot.handleUpdate(update(2));
    await bot.handleUpdate({
      update_id: 3,
      callback_query: { id: 'callback', data: 'post' },
    });
    assert.deepEqual(events, [[77, '/start'], 1, [77, '/start'], 'callback']);
  });
  it('waits for the complete handler before advancing the polling offset', async () => {
    const offsets = [];
    const bot = new Bot('123:test', {
      botInfo: { id: 123, username: 'testbot' },
      fetch: async (url, options) => {
        const params = JSON.parse(options.body);
        offsets.push(params.offset);
        return new Response(JSON.stringify({ ok: true, result: [update(1)] }));
      },
    });
    bot.command('start', async () => {
      await Promise.resolve();
      bot.stop();
    });
    await bot.start({ maxPolls: 2 });
    assert.deepEqual(offsets, [0]);
    assert.equal(bot.offset, 2);
    assert.equal(bot.isRunning(), false);
  });
  it('authenticates webhook requests and rejects invalid payloads', async () => {
    const bot = new Bot('123:test', { fetch: fakeFetch });
    const handle = webhookCallback(bot, { secretToken: 'secret' });
    assert.equal(
      (
        await handle(
          new globalThis.Request('http://localhost', {
            method: 'POST',
            body: '{}',
          })
        )
      ).status,
      403
    );
    assert.equal(
      (
        await handle(
          new globalThis.Request('http://localhost', {
            method: 'POST',
            headers: { 'x-telegram-bot-api-secret-token': 'secret' },
            body: JSON.stringify(update(1)),
          })
        )
      ).status,
      200
    );
  });
});
