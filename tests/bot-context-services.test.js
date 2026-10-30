import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Context as GrammyContext } from 'grammy';
import { Context as OriginalTelegrafContext } from 'telegraf';
import { Bot, Telegraf, Context, TelegrafContext } from '../src/index.js';
import {
  grammyServiceCases,
  telegrafServiceCases,
  serviceUpdates,
} from './fixtures/context-services.js';
import { recordingBot, contextOracle } from './fixtures/context-oracle.js';
import { uploadServer } from './fixtures/bot-upload-server.js';
import { selectedBotClient, botRequestFields } from './fixtures/bot-client.js';

const styles = [
  ['grammY', GrammyContext, Context, Bot, grammyServiceCases],
  [
    'Telegraf',
    OriginalTelegrafContext,
    TelegrafContext,
    Telegraf,
    telegrafServiceCases,
  ],
];
const complete = Object.assign({}, ...Object.values(serviceUpdates));

async function result(ctx, method, args) {
  try {
    return { value: await ctx[method](...args) };
  } catch (error) {
    return { error: { name: error.name, message: error.message } };
  }
}

for (const [style, Reference, Owned, Constructor, cases] of styles) {
  it(`inventories actual ${style} user, query, business and configuration helpers`, () => {
    assert.equal(cases.length, style === 'grammY' ? 51 : 27);
    for (const [name] of cases) {
      assert.equal(typeof Reference.prototype[name], 'function', name);
    }
  });
  for (const [method, args] of cases) {
    it(`matches actual ${style} ${method} across event scopes and errors`, async () => {
      const reference = contextOracle(style);
      const { bot, calls } = recordingBot(Constructor);
      const beforeArgs = globalThis.structuredClone(args);
      for (const update of Object.values(serviceUpdates)) {
        const before = globalThis.structuredClone(update);
        const expected = await result(
          new Reference(update, reference.api, {}),
          method,
          args
        );
        const actual = await result(
          new Owned(update, bot.api, {}, bot.telegram),
          method,
          args
        );
        assert.deepEqual(actual, expected, JSON.stringify(update));
        assert.deepEqual(update, before);
      }
      assert.deepEqual(calls, reference.calls);
      assert.deepEqual(args, beforeArgs);
    });
  }
}

for (const [style, Reference, Owned, Constructor, cases] of styles) {
  it(`forwards every ${style} service cancellation signal without payload fields`, async () => {
    const reference = contextOracle(style);
    const { bot, calls } = recordingBot(Constructor);
    const ctx = new Owned(complete, bot.api, {}, bot.telegram);
    const original = new Reference(complete, reference.api, {});
    const signal = new globalThis.AbortController().signal;
    for (const [method, args] of cases) {
      await ctx[method](...args, signal);
      assert.equal(calls.at(-1).signal, signal, method);
      assert(!('signal' in calls.at(-1).params), method);
      if (style === 'grammY') {
        await original[method](...args, signal);
      }
    }
    if (style === 'grammY') {
      assert.deepEqual(calls, reference.calls);
    }
  });

  it(`pre-cancels all ${style} service operations before HTTP`, async () => {
    let requests = 0;
    const bot = new Constructor('services:fixture', {
      fetch: async () => {
        requests++;
        return new Response(JSON.stringify({ ok: true, result: true }));
      },
    });
    const ctx = new Owned(complete, bot.api, {}, bot.telegram);
    const controller = new globalThis.AbortController();
    controller.abort(new Error('services stopped'));
    for (const [method, args] of cases) {
      await assert.rejects(
        ctx[method](...args, controller.signal),
        /services stopped/,
        method
      );
    }
    assert.equal(requests, 0);
  });

  for (const backend of [
    'native',
    'grammy',
    'telegraf',
    'node-telegram-bot-api',
  ]) {
    it(`routes ${style} service helpers through actual selected ${backend} HTTP`, async () => {
      const server = await uploadServer();
      try {
        const client = await selectedBotClient(
          backend,
          server.root,
          'services:fixture'
        );
        const bot = new Constructor('services:fixture', { api: client });
        const ctx = new Owned(complete, bot.api, {}, bot.telegram);
        await ctx.answerInlineQuery([], { cache_time: 0 });
        await ctx.getUserChatBoosts();
        if (style === 'grammY') {
          await ctx.setBusinessAccountName('Name', { last_name: 'Surname' });
          await ctx.getFile();
        } else {
          await ctx.setChatMenuButton({ type: 'commands' });
          await ctx.getStickerSet('stickers');
        }
        assert.equal(server.requests.length, 4);
        assert.deepEqual(botRequestFields(server.requests[0]), {
          inline_query_id: 'inline:1',
          results: [],
          cache_time: 0,
        });
        assert.deepEqual(botRequestFields(server.requests[1]), {
          chat_id: -1001,
          user_id: 8,
        });
        assert.deepEqual(
          botRequestFields(server.requests[2]),
          style === 'grammY'
            ? {
                business_connection_id: 'business:1',
                first_name: 'Name',
                last_name: 'Surname',
              }
            : { chat_id: -1001, menu_button: { type: 'commands' } }
        );
        assert.deepEqual(
          botRequestFields(server.requests[3]),
          style === 'grammY' ? { file_id: 'large:file' } : { name: 'stickers' }
        );
      } finally {
        await server.close();
      }
    });
  }
}

it('matches grammY file and custom emoji source precedence without mutating messages', async () => {
  const reference = contextOracle('grammY');
  const { bot, calls } = recordingBot(Bot);
  const variants = [
    {
      photo: [{ file_id: 'first' }, { file_id: 'last' }],
      animation: { file_id: 'ignored' },
    },
    { photo: [], document: { file_id: 'ignored' } },
    ...[
      'animation',
      'audio',
      'document',
      'video',
      'video_note',
      'voice',
      'sticker',
    ].map((key) => ({ [key]: { file_id: key } })),
    { audio: { file_id: 'audio' }, document: { file_id: 'ignored' } },
    {
      caption_entities: [{ type: 'custom_emoji', custom_emoji_id: 'ignored' }],
    },
    {
      entities: [
        { type: 'bold' },
        { type: 'custom_emoji', custom_emoji_id: 'emoji:2' },
        { type: 'custom_emoji', custom_emoji_id: 'emoji:2' },
      ],
    },
  ];
  for (const media of variants) {
    const update = {
      update_id: 1,
      message: { message_id: 0, chat: { id: 0 }, from: { id: 0 }, ...media },
    };
    const before = globalThis.structuredClone(update);
    const ctx = new Context(update, bot.api);
    const original = new GrammyContext(update, reference.api, {});
    for (const name of ['getFile', 'getCustomEmojiStickers']) {
      assert.deepEqual(
        await result(ctx, name, []),
        await result(original, name, [])
      );
    }
    assert.deepEqual(update, before);
  }
  assert.deepEqual(calls, reference.calls);
});

it('retains service deadlines and zero-valued context identifiers', async () => {
  const reference = contextOracle('grammY');
  const { bot, calls } = recordingBot(Bot);
  const update = {
    update_id: 0,
    message: {
      message_id: 0,
      chat: { id: 0 },
      from: { id: 0 },
      business_connection_id: '',
      story: { id: 0, chat: { id: 0 } },
    },
  };
  const ctx = new Context(update, bot.api);
  const original = new GrammyContext(update, reference.api, {});
  for (const [name, args] of [
    ['getUserChatBoosts', [0]],
    ['readBusinessMessage', []],
    ['repostStory', [86400]],
    ['getUserProfilePhotos', [{}]],
  ]) {
    assert.deepEqual(
      await result(ctx, name, args),
      await result(original, name, args)
    );
  }
  assert.deepEqual(calls, reference.calls);
  const controls = Object.freeze({
    signal: new globalThis.AbortController().signal,
    timeout: 25,
  });
  for (const name of ['getUserProfilePhotos', 'getBusinessAccountGifts']) {
    await ctx[name](controls);
    assert.equal(calls.at(-1).signal, controls.signal);
    assert.equal(calls.at(-1).timeout, 25);
    assert(
      !('signal' in calls.at(-1).params || 'timeout' in calls.at(-1).params)
    );
  }
});

for (const [style, Reference, Owned, , cases] of styles) {
  it(`preserves ${style} public API override argument shapes`, async () => {
    const observations = [];
    for (const Constructor of [Reference, Owned]) {
      const calls = [];
      const api = new Proxy(
        {},
        {
          get:
            (_, name) =>
            (...args) => {
              calls.push({ name, args });
              return Promise.resolve(true);
            },
        }
      );
      const ctx =
        Constructor === Owned
          ? new Owned(complete, api, {}, api)
          : new Reference(complete, api, {});
      for (const [method, args] of cases) {
        await ctx[method](...args);
      }
      observations.push(calls);
    }
    assert.deepEqual(observations[1], observations[0]);
  });
}
