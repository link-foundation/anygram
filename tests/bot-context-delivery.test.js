import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GrammyApi, Context as GrammyContext } from 'grammy';
import { Telegram, Context as OriginalTelegrafContext } from 'telegraf';
import {
  Bot,
  Telegraf,
  Context,
  TelegrafContext,
  InputFile,
} from '../src/index.js';
import { uploadServer } from './fixtures/bot-upload-server.js';
import { selectedBotClient, botRequestFields } from './fixtures/bot-client.js';
import {
  grammyDeliveryCases,
  telegrafDeliveryCases,
  deliveryUpdates,
} from './fixtures/context-delivery.js';

const styles = [
  ['grammY', GrammyContext, Context, Bot, grammyDeliveryCases],
  [
    'Telegraf',
    OriginalTelegrafContext,
    TelegrafContext,
    Telegraf,
    telegrafDeliveryCases,
  ],
];
const plain = (value) => JSON.parse(JSON.stringify(value));

function recording(Constructor) {
  const calls = [];
  const bot = new Constructor('delivery:fixture', {
    api: {
      callApi(method, params, options) {
        calls.push({
          method,
          params: plain(params),
          signal: options?.signal,
          timeout: options?.timeout,
        });
        return Promise.resolve(true);
      },
    },
  });
  return { bot, calls };
}

function oracle(style) {
  const calls = [];
  const api =
    style === 'grammY'
      ? new GrammyApi('oracle:fixture')
      : new Telegram('oracle:fixture');
  const record = (method, params, signal) => {
    calls.push({ method, params: plain(params), signal, timeout: undefined });
    return Promise.resolve(true);
  };
  if (style === 'grammY') {
    api.config.use(async (next, method, params, signal) => ({
      ok: true,
      result: await record(method, params, signal),
    }));
  } else {
    api.callApi = record;
  }
  return { api, calls };
}

for (const [style, Reference, Owned, Constructor, cases] of styles) {
  it(`inventories every pinned ${style} chat delivery shortcut`, () => {
    assert.equal(cases.length, style === 'grammY' ? 25 : 41);
    for (const { name } of cases) {
      assert.equal(typeof Reference.prototype[name], 'function', name);
    }
  });

  for (const { name, args } of cases) {
    it(`matches actual ${style} ${name} scopes and caller precedence`, async () => {
      const reference = oracle(style);
      const { bot, calls } = recording(Constructor);
      const beforeArgs = globalThis.structuredClone(args);
      const signal =
        style === 'grammY'
          ? new globalThis.AbortController().signal
          : undefined;
      for (const [shape, fields] of Object.entries(deliveryUpdates)) {
        if (shape === 'business' && style === 'Telegraf') {
          continue;
        }
        const update = globalThis.structuredClone(fields);
        const before = globalThis.structuredClone(update);
        const original = new Reference(update, reference.api, {});
        const owned = new Owned(update, bot.api, {}, bot.telegram);
        for (const extra of [
          undefined,
          Object.freeze({
            business_connection_id: 'override:business',
            message_thread_id: 47,
            direct_messages_topic_id: 53,
            parse_mode: 'HTML',
          }),
        ]) {
          await original[name](...args, extra, ...(signal ? [signal] : []));
          await owned[name](...args, extra, ...(signal ? [signal] : []));
        }
        assert.deepEqual(update, before);
      }
      assert.deepEqual(calls, reference.calls);
      assert.deepEqual(args, beforeArgs);
    });

    it(`matches actual ${style} ${name} missing-context errors before dispatch`, () => {
      const reference = oracle(style);
      const { bot, calls } = recording(Constructor);
      const original = new Reference(
        { update_id: 1, inline_query: {} },
        reference.api,
        {}
      );
      const owned = new Owned(original.update, bot.api, {}, bot.telegram);
      let expected;
      try {
        original[name](...args);
      } catch (error) {
        expected = error;
      }
      assert(expected, `${name} must reject missing scope`);
      assert.throws(() => owned[name](...args), {
        name: expected.name,
        message: expected.message,
      });
      assert.equal(calls.length, 0);
    });
  }

  it(`keeps ${style} delivery controls outside every payload`, async () => {
    const { bot, calls } = recording(Constructor);
    const ctx = new Owned(deliveryUpdates.topic, bot.api, {}, bot.telegram);
    const embedded = new globalThis.AbortController().signal;
    const explicit = new globalThis.AbortController().signal;
    const options = Object.freeze({
      signal: embedded,
      timeout: 25,
      message_thread_id: 97,
    });
    for (const { name, args } of cases) {
      await ctx[name](...args, options, explicit);
      const call = calls.at(-1);
      assert.equal(call.signal, explicit, name);
      assert.equal(call.timeout, 25, name);
      assert.equal(call.params.message_thread_id, 97, name);
      assert(!('signal' in call.params || 'timeout' in call.params), name);
    }
    assert.equal(options.signal, embedded);
  });

  for (const backend of [
    'native',
    'grammy',
    'telegraf',
    'node-telegram-bot-api',
  ]) {
    it(`delivers ${style} scoped requests through selected ${backend} HTTP`, async () => {
      const server = await uploadServer();
      try {
        const client = await selectedBotClient(
          backend,
          server.root,
          'delivery:fixture'
        );
        const bot = new Constructor('delivery:fixture', { api: client });
        const ctx = new Owned(deliveryUpdates.topic, bot.api, {}, bot.telegram);
        await ctx.replyWithLocation(1.5, 2.5);
        await ctx.replyWithMediaGroup([{ type: 'photo', media: 'photo:file' }]);
        assert.equal(server.requests.length, 2);
        const expected =
          style === 'grammY'
            ? {
                business_connection_id: 'business:1',
                direct_messages_topic_id: 23,
              }
            : {};
        assert.deepEqual(botRequestFields(server.requests[0]), {
          chat_id: -1007,
          latitude: 1.5,
          longitude: 2.5,
          message_thread_id: 19,
          ...expected,
        });
        assert.deepEqual(botRequestFields(server.requests[1]), {
          chat_id: -1007,
          media: [{ type: 'photo', media: 'photo:file' }],
          message_thread_id: 19,
          ...expected,
        });
        assert.match(server.requests[0].url, /\/sendLocation$/);
        assert.match(server.requests[1].url, /\/sendMediaGroup$/);
      } finally {
        await server.close();
      }
    });

    it(`bounds new ${style} media-group uploads before selected ${backend} dispatch`, async () => {
      const server = await uploadServer();
      let release;
      let watchdog;
      const blocked = new Promise((resolve) => {
        release = resolve;
      });
      try {
        const client = await selectedBotClient(
          backend,
          server.root,
          'delivery:fixture'
        );
        const bot = new Constructor('delivery:fixture', { api: client });
        const ctx = new Owned(deliveryUpdates.topic, bot.api, {}, bot.telegram);
        await assert.rejects(
          Promise.race([
            ctx.replyWithMediaGroup(
              [
                {
                  type: 'photo',
                  media: new InputFile(() => blocked, 'bounded.jpg'),
                },
              ],
              { timeout: 15 }
            ),
            new Promise((resolve, reject) => {
              watchdog = globalThis.setTimeout(
                () =>
                  reject(new Error('Context upload exceeded fixture deadline')),
                1000
              );
            }),
          ]),
          /timed out/i
        );
        assert.equal(server.requests.length, 0);
      } finally {
        globalThis.clearTimeout(watchdog);
        release([]);
        await server.close();
      }
    });
  }
}

it('matches grammY default dice arguments without shifting scoped options', async () => {
  const reference = oracle('grammY');
  const { bot, calls } = recording(Bot);
  await new GrammyContext(
    deliveryUpdates.topic,
    reference.api,
    {}
  ).replyWithDice();
  await new Context(deliveryUpdates.topic, bot.api).replyWithDice();
  assert.deepEqual(calls, reference.calls);
});

it('rejects a checklist without a business connection before any request', () => {
  const { bot, calls } = recording(Bot);
  const ctx = new Context(
    { update_id: 1, message: { chat: { id: 7 } } },
    bot.api
  );
  assert.throws(
    () => ctx.replyWithChecklist({ title: 'Tasks', tasks: [] }),
    /Missing information for API call to sendChecklist/
  );
  assert.equal(calls.length, 0);
});

it('retains actual dynamic Telegraf aliases and formatting override precedence', async () => {
  const { bot } = recording(Telegraf);
  const contexts = [
    new OriginalTelegrafContext(deliveryUpdates.topic, {}, {}),
    new TelegrafContext(deliveryUpdates.topic, bot.api, {}, bot.telegram),
  ];
  const observations = [];
  for (const ctx of contexts) {
    const calls = [];
    ctx.sendPhoto = (...args) => {
      calls.push(args);
      return Promise.resolve('photo');
    };
    assert.equal(await ctx.replyWithPhoto('file'), 'photo');
    ctx.reply = (...args) => {
      calls.push(args);
      return Promise.resolve('formatted');
    };
    assert.equal(
      await ctx.replyWithHTML('text', { parse_mode: 'Markdown' }),
      'formatted'
    );
    observations.push(calls);
  }
  assert.deepEqual(observations[1], observations[0]);
});

it('matches Telegraf missing-scope errors for updates without a type', () => {
  const reference = oracle('Telegraf');
  const { bot } = recording(Telegraf);
  const original = new OriginalTelegrafContext(
    { update_id: 1 },
    reference.api,
    {}
  );
  const owned = new TelegrafContext(original.update, bot.api, {}, bot.telegram);
  assert.throws(() => original.reply('text'), /Cannot determine `updateType`/);
  assert.throws(() => owned.reply('text'), /Cannot determine `updateType`/);
});
