import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  Bot,
  BotApi,
  Telegraf,
  TelegramBot,
  createAdapter,
  createClient,
} from '../src/index.js';
import { pollingKey } from '../src/polling.js';
import { uploadServer } from './fixtures/bot-upload-server.js';
import { telegrafWebhookResponse } from './fixtures/telegraf-webhook.js';
import { telegrafStartupStage } from './fixtures/telegraf-server.js';
import {
  configuredTelegraf,
  telegramMetadata,
  telegrafOptionsScenario,
} from './fixtures/telegraf-options.js';

for (const trailing of [false, true]) {
  for (const apiMode of ['bot', 'user']) {
    for (const testEnv of [false, true]) {
      it(`matches actual Telegraf nested root, ${apiMode}, test ${testEnv}, slash ${trailing}`, async () => {
        const options = { trailing, apiMode, testEnv };
        const reference = await telegrafOptionsScenario(true, options);
        assert.equal(reference.independent, true);
        assert.deepEqual(
          await telegrafOptionsScenario(false, options),
          reference
        );
      });
    }
  }
}

it('isolates mutable context Telegram settings from subsequent updates and the global client', async () => {
  const options = { mutate: true };
  const reference = await telegrafOptionsScenario(true, options);
  assert.equal(reference.paths[0], '/context/user123:options/test/sendMessage');
  assert.equal(reference.paths[1], '/prefix/bot123:options/sendMessage');
  assert.equal(reference.metadata[0].webhookReply, false);
  assert.equal(reference.metadata[1].webhookReply, true);
  assert.equal(reference.metadata[2].webhookReply, false);
  assert.deepEqual(await telegrafOptionsScenario(false, options), reference);
});

for (const options of [
  undefined,
  Object.freeze({
    apiRoot: undefined,
    apiMode: undefined,
    testEnv: undefined,
    webhookReply: undefined,
  }),
]) {
  it(`retains compacted Telegraf defaults with ${options ? 'undefined fields' : 'omitted settings'}`, () => {
    const reference = telegramMetadata(
      configuredTelegraf(true, options).telegram
    );
    assert.deepEqual(
      telegramMetadata(configuredTelegraf(false, options).telegram),
      reference
    );
  });
}

for (const kind of ['direct', 'unified']) {
  it(`retains a selected ${kind} backend for global and per-update calls despite nested native settings`, async () => {
    const calls = [];
    const backend = {
      callApi: async (method, params) => {
        calls.push([method, params]);
        return true;
      },
    };
    const api =
      kind === 'direct'
        ? backend
        : await createClient({
            native: false,
            adapters: [createAdapter('chosen', backend, { kind: 'bot' })],
            backend: 'chosen',
          });
    const bot = configuredTelegraf(
      false,
      { apiRoot: 'https://unused.invalid' },
      { api }
    );
    bot.use(async (ctx) => {
      assert.equal(ctx.telegram.token, '123:options');
      assert.notEqual(ctx.telegram.options, bot.telegram.options);
      ctx.telegram.options.apiRoot = 'https://also-unused.invalid';
      await ctx.telegram.sendMessage(7, 'context');
    });
    await bot.handleUpdate({ update_id: 1 });
    await bot.telegram.sendMessage(7, 'global');
    assert.deepEqual(calls, [
      ['sendMessage', { chat_id: 7, text: 'context' }],
      ['sendMessage', { chat_id: 7, text: 'global' }],
    ]);
  });
}

for (const reply of [true, false]) {
  it(`retains per-update settings with an actual SDK webhook reply policy ${reply}`, async () => {
    const probe = async (reference) => {
      const server = await uploadServer({ maxRequests: 1 });
      try {
        const bot = configuredTelegraf(reference, {
          apiRoot: server.root,
          webhookReply: !reply,
        });
        let context;
        bot.use(async (ctx) => {
          context = ctx.telegram;
          ctx.telegram.options.webhookReply = reply;
          ctx.telegram.options.testEnv = true;
          await ctx.telegram.deleteMessage(7, 9);
        });
        const { response, snapshot } = telegrafWebhookResponse();
        await bot.handleUpdate({ update_id: 1 }, response);
        return {
          response: snapshot(),
          globalReply: bot.telegram.webhookReply,
          contextReply: context.webhookReply,
          globalTest: bot.telegram.options.testEnv,
          paths: server.requests.map((request) => request.url),
        };
      } finally {
        await server.close();
      }
    };
    assert.deepEqual(await probe(false), await probe(true));
  });
}

for (const [label, firstOptions, secondOptions, conflict, selected] of [
  [
    'different roots',
    { apiRoot: 'http://127.0.0.1:1/a/' },
    { apiRoot: 'http://127.0.0.1:1/b/' },
    false,
  ],
  ['different environments', { testEnv: false }, { testEnv: true }, false],
  ['different modes', { apiMode: 'bot' }, { apiMode: 'user' }, false],
  [
    'equivalent relative roots',
    { apiRoot: 'http://127.0.0.1:1/a/first' },
    { apiRoot: 'http://127.0.0.1:1/a/second' },
    true,
  ],
  [
    'selected transports ignoring native roots',
    { apiRoot: 'http://127.0.0.1:1/a/' },
    { apiRoot: 'http://127.0.0.1:1/b/' },
    true,
    true,
  ],
]) {
  it(`scopes polling ownership to actual Telegram endpoints for ${label}`, async () => {
    let entered;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    let finish;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    const make = (telegram, blocking) => {
      const result = async (method) => {
        const polling = String(method).endsWith('getUpdates');
        if (polling && blocking) {
          entered();
          await pending;
        }
        return polling ? [] : true;
      };
      const bot = new Telegraf('123:poll-options', {
        telegram: { apiRoot: 'http://127.0.0.1:1/', ...telegram },
        botInfo: { id: 123, username: 'bot' },
        ...(selected && { api: { callApi: result } }),
        fetch: async (url) =>
          globalThis.Response.json({
            ok: true,
            result: await result(url),
          }),
      });
      return bot;
    };
    const first = make(firstOptions, true);
    const second = make(secondOptions, false);
    const launched = first.launch({ maxPolls: 1, timeout: 0 });
    try {
      await telegrafStartupStage(started);
      const launch = second.launch({ maxPolls: 1, timeout: 0 });
      if (conflict) {
        await assert.rejects(launch, /Another bot instance/);
      } else {
        await launch;
      }
    } finally {
      first.stop();
      second.stop();
      finish();
      await launched;
    }
  });
}

it('preserves object-key identity without coercing a custom transport token', () => {
  const token = { toString: () => assert.fail('custom token was coerced') };
  const api = {};
  assert.equal(pollingKey(token, { api }), api);
});

it('retains relative owned base URLs understood by a custom fetch hook', async () => {
  const paths = [];
  const bot = new Telegraf('123:relative-options', {
    baseUrl: '/relative',
    botInfo: { id: 123 },
    fetch: async (url) => {
      paths.push(String(url));
      return globalThis.Response.json({ ok: true, result: true });
    },
  });
  bot.use((ctx) => ctx.telegram.sendMessage(7, 'context'));
  await bot.handleUpdate({ update_id: 1 });
  await bot.telegram.sendMessage(7, 'global');
  await bot.launch({ maxPolls: 0 });
  assert.deepEqual(
    paths,
    Array(2).fill('/relative/bot123:relative-options/sendMessage')
  );
});

it('rejects invalid native mode and environment settings before any fetch', async () => {
  const fetch = () => assert.fail('invalid native settings reached fetch');
  for (const options of [
    { apiMode: '../other/' },
    { apiMode: null },
    { testEnv: 'false' },
    { testEnv: null },
  ]) {
    assert.throws(
      () => new BotApi({ token: '123:options', fetch, ...options }),
      TypeError
    );
  }
  const bot = configuredTelegraf(false, undefined, { fetch });
  bot.telegram.options.apiMode = '../other/';
  await assert.rejects(bot.telegram.getMe(), TypeError);
});

for (const Constructor of [Bot, TelegramBot]) {
  it(`shares endpoint ownership with the ${Constructor.name} facade`, async () => {
    let entered;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    let finish;
    const pending = new Promise((resolve) => {
      finish = resolve;
    });
    const first = new Constructor('123:cross-options', {
      baseUrl: 'http://127.0.0.1:1/a',
      apiMode: 'user',
      testEnv: true,
      botInfo: { id: 123 },
      fetch: async () => {
        entered();
        await pending;
        return globalThis.Response.json({ ok: true, result: [] });
      },
    });
    const second = new Telegraf('123:cross-options', {
      telegram: { apiRoot: 'http://127.0.0.1:1/unused', apiMode: 'user' },
      botInfo: { id: 123 },
      fetch: async (url) => {
        assert.equal(String(url).endsWith('/getUpdates'), false);
        return globalThis.Response.json({ ok: true, result: true });
      },
    });
    // Global settings changed before launch determine the actual endpoint.
    Object.assign(second.telegram.options, {
      apiRoot: 'http://127.0.0.1:1/a/file',
      testEnv: true,
    });
    const launched = first.launch({ maxPolls: 1, timeout: 0 });
    try {
      await telegrafStartupStage(started);
      await assert.rejects(
        second.launch({ maxPolls: 1, timeout: 0 }),
        /Another bot instance/
      );
    } finally {
      first.stop();
      second.stop();
      finish();
      await launched;
    }
  });
}
