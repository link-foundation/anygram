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

it('rejects competing in-process pollers for the same bot and releases ownership on stop (node bot #550)', async () => {
  let started;
  const ready = new Promise((resolve) => {
    started = resolve;
  });
  const options = {
    botInfo: { id: 123 },
    fetch: async (url, options) => {
      started();
      await new Promise((resolve) => {
        if (options.signal.aborted) {
          resolve();
        } else {
          options.signal.addEventListener('abort', resolve, { once: true });
        }
      });
      throw new Error('cancelled');
    },
  };
  const first = new Bot('550:shared', options);
  const second = new Bot('550:shared', {
    botInfo: { id: 123 },
    fetch: () => assert.fail('duplicate poll reached network'),
  });
  const polling = first.start({ maxPolls: 1 });
  await ready;
  try {
    await assert.rejects(
      second.start({ maxPolls: 1 }),
      (error) => error.type === 'POLLING_CONFLICT'
    );
  } finally {
    first.stop();
    await polling;
  }
  await second.start({ maxPolls: 0 });
  assert.equal(second.isRunning(), false);
});

it('subscribes to explicit membership updates independently of join service messages (node bot #1161)', async () => {
  const member = {
    chat: { id: -1001 },
    from: { id: 10 },
    old_chat_member: { status: 'left' },
    new_chat_member: { status: 'member' },
  };
  const bot = new Bot('1161:membership', {
    botInfo: { id: 123 },
    fetch: async (url, options) => {
      assert.deepEqual(JSON.parse(options.body).allowed_updates, [
        'chat_member',
      ]);
      return new Response(
        JSON.stringify({
          ok: true,
          result: [{ update_id: 1, chat_member: member }],
        })
      );
    },
  });
  let observed;
  bot.on('chat_member', (ctx) => {
    assert.equal(ctx.from.id, 10);
    assert.equal(ctx.chat.id, -1001);
    observed = ctx.update.chat_member;
  });
  await bot.start({ maxPolls: 1, allowed_updates: ['chat_member'] });
  assert.deepEqual(observed, member);
});

it('validates finite polling controls before connecting', async () => {
  const bot = new Bot('123:invalid', {
    fetch: () => assert.fail('invalid polling reached network'),
  });
  for (const options of [
    { maxPolls: -1 },
    { maxPolls: 0.5 },
    { maxPolls: NaN },
    { timeout: -1 },
    { timeout: 0.5 },
  ]) {
    await assert.rejects(bot.start(options), /polling/i);
  }
});
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
  it('propagates a handler failure even when the handler requests shutdown', async () => {
    const bot = new Bot('123:test', {
      botInfo: { id: 123, username: 'testbot' },
      fetch: async () =>
        new Response(JSON.stringify({ ok: true, result: [update(1)] })),
    });
    bot.command('start', () => {
      bot.stop();
      throw new Error('database write failed');
    });
    await assert.rejects(bot.start({ maxPolls: 1 }), /database write failed/);
    assert.equal(bot.offset, 0);
    assert.equal(bot.seen.has(1), false);
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
