import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Bot, Telegraf, webhookCallback } from '../src/index.js';
import { webhookReplyScenario } from './fixtures/webhook-reply.js';

for (const style of ['grammy', 'telegraf']) {
  for (const backend of [
    'native',
    'grammy',
    'telegraf',
    'node-telegram-bot-api',
  ]) {
    it(`owns one ${style} webhook reply while retaining actual ${backend} fallback`, async () => {
      const result = await webhookReplyScenario(
        style,
        false,
        async (bot, dispatch) => {
          bot.use(async (ctx) => {
            if (style === 'grammy') {
              await ctx.reply('response');
              await ctx.reply('HTTP');
            } else {
              await ctx.deleteMessage();
              await ctx.reply('HTTP');
            }
          });
          await dispatch();
        },
        { backend, client: { canUseWebhookReply: () => true } }
      );
      assert.equal(result.bodies.length, 1);
      assert.equal(result.requests.length, 1);
      assert.equal(result.requests[0].method, 'sendMessage');
      assert.equal(result.requests[0].params.text, 'HTTP');
    });
  }
}

it('retires unused response ownership when a handler completes', async () => {
  const result = await webhookReplyScenario(
    'grammy',
    false,
    async (bot, dispatch) => {
      let context;
      bot.use((ctx) => {
        context = ctx;
      });
      await dispatch();
      await context.reply('late HTTP');
    },
    { client: { canUseWebhookReply: () => true } }
  );
  assert.equal(result.bodies.length, 0);
  assert.equal(result.requests[0].params.text, 'late HTTP');
});

it('cleans processing ownership when ending an unused response throws', async () => {
  const failure = new Error('closed socket');
  const bot = new Telegraf('123:webhook');
  const update = { update_id: 1 };
  await assert.rejects(
    bot.handleUpdate(update, {
      end() {
        throw failure;
      },
    }),
    failure
  );
  assert.equal(bot.processing.size, 0);
});

it('retires a failed handler response before an independently queued update', async () => {
  const sent = [];
  let context;
  const failure = new Error('middleware failed');
  const bot = new Bot('123:webhook', {
    client: { canUseWebhookReply: () => true },
    api: {
      callApi: async (...args) => {
        sent.push(args);
        return true;
      },
    },
  });
  bot.use((ctx) => {
    context = ctx;
    throw failure;
  });
  await assert.rejects(
    bot.handleUpdate(
      { update_id: 1 },
      {
        send() {
          throw new Error('retired');
        },
      }
    ),
    failure
  );
  await context.api.sendMessage(7, 'HTTP after error');
  assert.equal(sent[0][1].text, 'HTTP after error');
  assert.equal(bot.processing.size, 0);
});

it('returns a JSON webhook operation from the Fetch callback', async () => {
  const bot = new Bot('123:webhook', {
    client: { canUseWebhookReply: () => true },
  });
  bot.use((ctx) => ctx.reply('fast'));
  const response = await webhookCallback(bot)(
    new globalThis.Request('http://localhost/webhook', {
      method: 'POST',
      body: JSON.stringify({
        update_id: 1,
        message: { message_id: 9, chat: { id: 7 } },
      }),
    })
  );
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), {
    method: 'sendMessage',
    chat_id: 7,
    text: 'fast',
  });
});
