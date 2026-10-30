import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Bot } from '../src/index.js';
import { uploadServer } from './fixtures/bot-upload-server.js';
import { selectedBotClient, botRequestFields } from './fixtures/bot-client.js';

for (const backend of [
  'native',
  'grammy',
  'telegraf',
  'node-telegram-bot-api',
]) {
  it(`routes a scoped callback acknowledgement and edit through actual ${backend} HTTP`, async () => {
    const server = await uploadServer({ maxRequests: 2 });
    const token = 'queries:fixture';
    const update = {
      update_id: 1,
      callback_query: {
        id: 'callback:1',
        data: 'terminal:refresh',
        from: { id: 8 },
        message: { message_id: 9, chat: { id: 7 } },
      },
    };
    const before = globalThis.structuredClone(update);
    try {
      const bot = new Bot(token, {
        api: await selectedBotClient(backend, server.root, token),
      });
      const signal = new globalThis.AbortController().signal;
      let scoped = 0;
      bot.callbackQuery('terminal:refresh').use(async (ctx) => {
        assert.equal(ctx.match, 'terminal:refresh');
        assert.equal(ctx.from, update.callback_query.from);
        await ctx.answerCallbackQuery({ text: 'refreshed' }, signal);
        await ctx.editMessageText('terminal output', { timeout: 2000 }, signal);
        scoped++;
      });
      await bot.handleUpdate({ update_id: 0, message: { text: 'unrelated' } });
      assert.equal(scoped, 0);
      assert.equal(server.requests.length, 0);
      await bot.handleUpdate(update);
      await bot.handleUpdate(update);
      assert.equal(scoped, 1);
      assert.deepEqual(update, before);
      assert.deepEqual(
        server.requests.map((request) => ({
          method: request.url.split('/').at(-1),
          params: botRequestFields(request),
        })),
        [
          {
            method: 'answerCallbackQuery',
            params: { callback_query_id: 'callback:1', text: 'refreshed' },
          },
          {
            method: 'editMessageText',
            params: { chat_id: 7, message_id: 9, text: 'terminal output' },
          },
        ]
      );
    } finally {
      await server.close();
    }
  });
}
