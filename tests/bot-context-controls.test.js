import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GrammyApi, Context as GrammyContext } from 'grammy';
import { Telegram, Context as OriginalTelegrafContext } from 'telegraf';
import {
  Bot,
  Telegraf,
  TelegramBot,
  Context,
  InputFile,
  createClient,
} from '../src/index.js';

const noPayload = [
  'getMe',
  'getWebhookInfo',
  'getForumTopicIconStickers',
  'getAvailableGifts',
  'logOut',
  'close',
  'getMyStarBalance',
  'removeMyProfilePhoto',
];
const media = [
  'Photo',
  'Animation',
  'Video',
  'Audio',
  'Voice',
  'Document',
  'Sticker',
];
const update = {
  update_id: 1,
  callback_query: {
    id: 'callback',
    from: { id: 8 },
    message: { message_id: 9, chat: { id: 7 } },
  },
};

function recordingBot(Constructor = Bot) {
  const calls = [];
  return {
    calls,
    bot: new Constructor('controls:fixture', {
      api: {
        callApi(method, params, options) {
          calls.push({
            method,
            params,
            signal: options?.signal,
            timeout: options?.timeout,
          });
          return Promise.resolve(true);
        },
      },
    }),
  };
}

function positional(api, signal) {
  return [
    () => api.sendMessage(7, 'text', { disable_notification: true }, signal),
    () => api.deleteMessage(7, 9, signal),
    () => api.answerCallbackQuery('callback', { text: 'ack' }, signal),
    ...media.map(
      (kind) => () =>
        api[`send${kind}`](7, 'remote-file', { caption: 'caption' }, signal)
    ),
    () => api.editMessageText(7, 9, 'edited', { parse_mode: 'HTML' }, signal),
    () => api.editMessageTextInline('inline', 'edited', {}, signal),
  ];
}

async function contextCalls(ctx, signal) {
  await ctx.reply('reply', {}, signal);
  await ctx.editMessageText('edit', {}, signal);
  await ctx.answerCallbackQuery('ack', signal);
  await ctx.deleteMessage(signal);
  for (const kind of media) {
    await ctx[`replyWith${kind}`]('remote-file', {}, signal);
  }
}

it('matches actual grammY context payloads and cancellation signals', async () => {
  const expected = [];
  const reference = new GrammyApi('oracle:fixture');
  reference.config.use((next, method, params, signal) => {
    expected.push({ method, params, signal, timeout: undefined });
    return Promise.resolve({ ok: true, result: true });
  });
  const signal = new globalThis.AbortController().signal;
  await contextCalls(new GrammyContext(update, reference, {}), signal);
  const { bot, calls } = recordingBot();
  await contextCalls(new Context(update, bot.api), signal);
  const normalized = (entries) =>
    entries.map((entry) => ({
      ...entry,
      params: JSON.parse(JSON.stringify(entry.params)),
    }));
  assert.deepEqual(normalized(calls), normalized(expected));
});

it('matches actual Telegraf context payloads and explicit message deletion', async () => {
  const expected = [];
  const reference = new Telegram('oracle:fixture');
  reference.callApi = (method, params) => {
    expected.push({ method, params });
    return Promise.resolve(true);
  };
  const { bot, calls } = recordingBot(Telegraf);
  for (const ctx of [
    new OriginalTelegrafContext(update, reference, {}),
    new Context(update, bot.api, {}, bot.telegram),
  ]) {
    await ctx.reply('reply', { disable_notification: true });
    await ctx.editMessageText('edited');
    await (ctx.answerCbQuery ?? ctx.answerCallbackQuery).call(ctx, 'ack');
    await ctx.deleteMessage(10);
    await ctx.replyWithPhoto('remote-file');
  }
  assert.deepEqual(
    JSON.parse(
      JSON.stringify(calls.map(({ method, params }) => ({ method, params })))
    ),
    JSON.parse(JSON.stringify(expected))
  );
});

it('uses an explicit positional signal before an embedded signal without mutation', async () => {
  const { bot, calls } = recordingBot();
  const embedded = new globalThis.AbortController().signal;
  const explicit = new globalThis.AbortController().signal;
  const options = Object.freeze({ signal: embedded, timeout: 25 });
  await bot.api.sendMessage(7, 'text', options, explicit);
  assert.equal(calls[0].signal, explicit);
  assert.equal(calls[0].timeout, 25);
  assert.deepEqual(calls[0].params, { chat_id: 7, text: 'text' });
  assert.equal(options.signal, embedded);
});

it('matches every supported grammY positional signal against its actual API', async () => {
  const expected = [];
  const reference = new GrammyApi('oracle:fixture');
  reference.config.use((next, method, params, signal) => {
    expected.push({ method, params, signal, timeout: undefined });
    return Promise.resolve({ ok: true, result: true });
  });
  const signal = new globalThis.AbortController().signal;
  for (const call of positional(reference, signal)) {
    await call();
  }
  const { bot, calls } = recordingBot();
  for (const call of positional(bot.api, signal)) {
    await call();
  }
  assert.deepEqual(calls, expected);
});

for (const method of noPayload) {
  it(`retains the actual grammY zero-payload signal signature for ${method}`, async () => {
    const signal = new globalThis.AbortController().signal;
    const { bot, calls } = recordingBot();
    const reference = new GrammyApi('oracle:fixture');
    let expected;
    reference.config.use((next, name, params, seen) => {
      expected = { method: name, params, signal: seen, timeout: undefined };
      return Promise.resolve({ ok: true, result: true });
    });
    await reference[method](signal);
    await bot.api[method](signal);
    assert.deepEqual(calls, [expected]);
    calls.length = 0;
    await bot.api.raw[method](signal);
    assert.deepEqual(calls, [expected]);
  });
}

it('separates embedded request controls on both bot positional views', async () => {
  const signal = new globalThis.AbortController().signal;
  for (const view of ['api', 'telegram']) {
    const { bot, calls } = recordingBot();
    const api = bot[view];
    const options = { signal, timeout: 25, parse_mode: 'HTML' };
    await api.sendMessage(7, 'text', options);
    await api.answerCallbackQuery('callback', { signal, timeout: 25 });
    await api.sendPhoto(7, 'remote-file', options);
    if (view === 'telegram') {
      await api.editMessageText(7, 9, undefined, 'edited', options);
    } else {
      await api.editMessageText(7, 9, 'edited', options);
    }
    await api.deleteMessage(7, 9, { signal, timeout: 25 });
    for (const call of calls) {
      assert.equal(call.signal, signal);
      assert.equal(call.timeout, 25);
      assert(!('signal' in call.params) && !('timeout' in call.params));
    }
    assert.equal(options.signal, signal);
    assert.equal(options.timeout, 25);
  }
});

it('preserves actual Telegraf payloads with its separate positional edit signature', async () => {
  const reference = new Telegram('oracle:fixture');
  const expected = [];
  reference.callApi = (method, params) => {
    expected.push({ method, params });
    return Promise.resolve(true);
  };
  const { bot, calls } = recordingBot(Telegraf);
  for (const api of [reference, bot.telegram]) {
    await api.sendMessage(7, 'text', { disable_notification: true });
    await api.sendPhoto(7, 'remote-file', { caption: 'caption' });
    await api.editMessageText(7, 9, undefined, 'edited', {
      parse_mode: 'HTML',
    });
    await api.deleteMessage(7, 9);
  }
  assert.deepEqual(
    calls.map(({ method, params }) => ({ method, params })),
    expected
  );
});

for (const Constructor of [Bot, Telegraf]) {
  it(`forwards context signals and embedded controls for ${Constructor.name}`, async () => {
    const { bot, calls } = recordingBot(Constructor);
    const ctx = new Context(update, bot.api, {}, bot.telegram);
    const signal = new globalThis.AbortController().signal;
    await ctx.reply('reply', {}, signal);
    await ctx.editMessageText('edit', {}, signal);
    await ctx.answerCallbackQuery('ack', signal);
    await ctx.deleteMessage(signal);
    for (const kind of media) {
      await ctx[`replyWith${kind}`]('remote-file', {}, signal);
    }
    for (const call of calls) {
      assert.equal(call.signal, signal);
    }
    assert.equal(
      calls.find((c) => c.method === 'deleteMessage').params.message_id,
      9
    );
    calls.length = 0;
    await ctx.reply('reply', { signal, timeout: 25 });
    await ctx.editMessageText('edit', { signal, timeout: 25 });
    await ctx.deleteMessage(10, { signal, timeout: 25 });
    for (const call of calls) {
      assert.equal(call.timeout, 25);
      assert.equal(call.signal, signal);
      assert(!('signal' in call.params) && !('timeout' in call.params));
    }
    assert.equal(calls.at(-1).params.message_id, 10);
  });
}

it('forwards request controls from node-style event aliases', async () => {
  const { bot, calls } = recordingBot(TelegramBot);
  const signal = new globalThis.AbortController().signal;
  await bot.sendMessage(7, 'text', { signal, timeout: 25 });
  await bot.editMessageText('edited', {
    chat_id: 7,
    message_id: 9,
    signal,
    timeout: 25,
  });
  await bot.deleteMessage(7, 9, { signal, timeout: 25 });
  await bot.answerCallbackQuery('callback', { signal, timeout: 25 });
  await bot.getChat(7, { signal, timeout: 25 });
  for (const call of calls) {
    assert.equal(call.signal, signal);
    assert.equal(call.timeout, 25);
    assert(!('signal' in call.params) && !('timeout' in call.params));
  }
});

it('preserves legitimate raw Telegram timeout parameters while accepting raw signals', async () => {
  const { bot, calls } = recordingBot();
  const signal = new globalThis.AbortController().signal;
  await bot.api.raw.getUpdates({ timeout: 30, offset: 2 }, signal);
  assert.deepEqual(calls, [
    {
      method: 'getUpdates',
      params: { timeout: 30, offset: 2 },
      signal,
      timeout: undefined,
    },
  ]);
});

it('cancels native positional helpers before dispatching any request', async () => {
  let requests = 0;
  const bot = new Bot('controls:fixture', {
    fetch: async () => {
      requests++;
      return new Response(JSON.stringify({ ok: true, result: true }));
    },
  });
  const controller = new globalThis.AbortController();
  controller.abort(new Error('stopped'));
  for (const call of positional(bot.api, controller.signal)) {
    await assert.rejects(call(), /stopped/);
  }
  for (const method of noPayload) {
    await assert.rejects(bot.api[method](controller.signal), /stopped/);
  }
  assert.equal(requests, 0);
});

for (const backend of [
  'native',
  'grammy',
  'telegraf',
  'node-telegram-bot-api',
]) {
  it(`bounds a blocked context upload before the selected ${backend} dispatch`, async () => {
    const api = await createClient({
      token: 'controls:fixture',
      backend,
      native: backend === 'native',
      libraries: backend === 'native' ? [] : [backend],
    });
    const bot = new Bot('controls:fixture', { api });
    const ctx = new Context(update, bot.api);
    let release;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    const input = new InputFile(() => blocked, 'bounded.bin');
    let watchdog;
    try {
      await assert.rejects(
        Promise.race([
          ctx.replyWithDocument(input, { timeout: 15 }),
          new Promise((resolve, reject) => {
            watchdog = globalThis.setTimeout(
              () => reject(new Error('Context deadline did not reach upload')),
              150
            );
          }),
        ]),
        /timed out/i
      );
    } finally {
      release([]);
      globalThis.clearTimeout(watchdog);
    }
  });
}
