import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { InputFile as OriginalInputFile } from 'grammy';
import { InputFile } from '../src/index.js';
import { webhookReplyScenario } from './fixtures/webhook-reply.js';

async function compare(style, run, options) {
  const expected = await webhookReplyScenario(style, true, run, options);
  const actual = await webhookReplyScenario(style, false, run, options);
  assert.deepEqual(actual, expected);
  return actual;
}

it('keeps grammY webhook replies disabled by default like the actual SDK', async () => {
  const result = await compare('grammy', async (bot, dispatch) => {
    bot.use((ctx) => ctx.reply('ordinary'));
    await dispatch();
  });
  assert.equal(result.bodies.length, 0);
  assert.equal(result.requests.length, 1);
});

it('matches actual grammY one-use JSON webhook replies and global API isolation', async () => {
  const result = await compare(
    'grammy',
    async (bot, dispatch) => {
      const values = [];
      bot.use(async (ctx) => {
        values.push(ctx.api === bot.api);
        values.push(await bot.api.sendMessage(7, 'global'));
        values.push(await ctx.reply('fast'));
        values.push(await ctx.reply('ordinary'));
      });
      await dispatch();
      return values;
    },
    { client: { canUseWebhookReply: () => true } }
  );
  assert.deepEqual(result.bodies, [
    { method: 'sendMessage', chat_id: 7, text: 'fast' },
  ]);
  assert.deepEqual(
    result.requests.map(({ params }) => params.text),
    ['global', 'ordinary']
  );
});

it('matches actual grammY predicate calls before and after claiming the reply', async () => {
  const calls = [];
  const run = async (bot, dispatch) => {
    bot.use(async (ctx) => {
      await ctx.api.getMe();
      await ctx.reply('selected');
      await ctx.api.getMe();
    });
    await dispatch();
  };
  const probe = (reference) =>
    webhookReplyScenario('grammy', reference, run, {
      client: {
        canUseWebhookReply(method) {
          calls.push(method);
          return method === 'sendMessage';
        },
      },
    });
  const expected = await probe(true);
  const expectedCalls = calls.splice(0);
  const actual = await probe(false);
  assert.deepEqual(actual, expected);
  assert.deepEqual(calls, expectedCalls);
  assert.deepEqual(calls, ['getMe', 'sendMessage']);
});

it('claims the grammY response synchronously for concurrent API calls', async () => {
  const result = await compare(
    'grammy',
    async (bot, dispatch) => {
      bot.use((ctx) => Promise.all([ctx.reply('first'), ctx.reply('second')]));
      await dispatch();
    },
    { client: { canUseWebhookReply: () => true } }
  );
  assert.equal(result.bodies.length, 1);
  assert.equal(result.requests.length, 1);
});

it('matches actual grammY per-update reply ownership for nested dispatch', async () => {
  const result = await compare(
    'grammy',
    async (bot, dispatch) => {
      bot.use(async (ctx) => {
        if (ctx.update.update_id === 1) {
          await dispatch();
        }
        await ctx.reply(String(ctx.update.update_id));
      });
      await dispatch();
    },
    { client: { canUseWebhookReply: () => true } }
  );
  assert.deepEqual(
    result.bodies.map(({ text }) => text),
    ['2', '1']
  );
});

it('does not replay a grammY reply when its send function fails', async () => {
  const result = await compare(
    'grammy',
    async (bot, dispatch) => {
      const failure = new Error('reply send failed');
      const values = [];
      bot.use(async (ctx) => {
        try {
          await ctx.reply('failed');
        } catch (error) {
          values.push(error === failure);
        }
        values.push(await ctx.reply('next'));
      });
      await dispatch({ failSend: failure });
      return values;
    },
    { client: { canUseWebhookReply: () => true } }
  );
  assert.deepEqual(result.values, [true, true]);
  assert.deepEqual(
    result.requests.map(({ params }) => params.text),
    ['next']
  );
});

it('matches actual grammY multipart exclusion without consuming the reply', async () => {
  const probe = (reference) =>
    webhookReplyScenario(
      'grammy',
      reference,
      async (bot, dispatch) => {
        const File = reference ? OriginalInputFile : InputFile;
        bot.use(async (ctx) => {
          await ctx.replyWithPhoto(
            new File(new Uint8Array([1, 2, 3]), 'photo.png')
          );
          await ctx.reply('JSON');
        });
        await dispatch();
      },
      { client: { canUseWebhookReply: () => true } }
    );
  const expected = await probe(true);
  const actual = await probe(false);
  assert.deepEqual(actual, expected);
  assert.deepEqual(actual.requests, [
    { method: 'sendPhoto', params: 'multipart' },
  ]);
  assert.equal(actual.bodies[0].text, 'JSON');
});

for (const method of [
  'answerCallbackQuery',
  'answerInlineQuery',
  'deleteMessage',
  'leaveChat',
  'sendChatAction',
]) {
  it(`matches actual Telegraf default webhook reply for ${method}`, async () => {
    const result = await compare('telegraf', async (bot, dispatch) => {
      bot.use(async (ctx) => {
        await ctx.telegram.callApi(method, { chat_id: 7, message_id: 9 });
        await ctx.telegram.callApi(method, { chat_id: 7, message_id: 10 });
      });
      const response = await dispatch();
      return response.writableEnded;
    });
    assert.equal(result.values, true);
    assert.equal(result.bodies.length, 1);
    assert.equal(result.requests.length, 1);
  });
}

it('matches actual Telegraf exclusions and context-local webhookReply toggles', async () => {
  const result = await compare('telegraf', async (bot, dispatch) => {
    const flags = [];
    bot.use(async (ctx) => {
      flags.push(ctx.webhookReply);
      await ctx.reply('ordinary');
      ctx.webhookReply = false;
      await ctx.deleteMessage();
      ctx.webhookReply = true;
      await ctx.deleteMessage();
    });
    await dispatch();
    await dispatch();
    flags.push(bot.telegram.webhookReply);
    return flags;
  });
  assert.deepEqual(result.values, [true, true, true]);
  assert.equal(result.bodies.length, 2);
  assert.equal(result.requests.length, 4);
});

it('matches actual grammY fast replies with an already aborted request signal', async () => {
  const result = await compare(
    'grammy',
    async (bot, dispatch) => {
      const controller = new globalThis.AbortController();
      controller.abort(new Error('cancelled'));
      bot.use((ctx) => ctx.reply('fast', {}, controller.signal));
      await dispatch();
    },
    { client: { canUseWebhookReply: () => true } }
  );
  assert.equal(result.bodies.length, 1);
  assert.equal(result.requests.length, 0);
});

it('matches actual grammY behavior for an envelope without a sender', async () => {
  const result = await compare(
    'grammy',
    async (bot) => {
      bot.use((ctx) => ctx.api.getMe());
      await bot.handleUpdate({ update_id: 1 }, {});
    },
    { client: { canUseWebhookReply: () => true } }
  );
  assert.equal(result.requests.length, 1);
});

it('copies the actual Telegraf global reply policy into each context', async () => {
  const result = await compare('telegraf', async (bot, dispatch) => {
    const flags = [];
    bot.telegram.webhookReply = false;
    bot.use(async (ctx) => {
      flags.push(ctx.webhookReply);
      await ctx.deleteMessage();
    });
    const response = await dispatch();
    return [...flags, response.writableEnded];
  });
  assert.deepEqual(result.values, [false, true]);
  assert.equal(result.bodies.length, 0);
  assert.equal(result.requests.length, 1);
});
