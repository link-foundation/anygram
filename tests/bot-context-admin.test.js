import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Context as GrammyContext } from 'grammy';
import { Context as OriginalTelegrafContext } from 'telegraf';
import { Bot, Telegraf, Context, TelegrafContext } from '../src/index.js';
import {
  grammyAdminCases,
  telegrafAdminCases,
  adminUpdates,
} from './fixtures/context-admin.js';
import { recordingBot, contextOracle } from './fixtures/context-oracle.js';
import { uploadServer } from './fixtures/bot-upload-server.js';
import { selectedBotClient, botRequestFields } from './fixtures/bot-client.js';

const styles = [
  ['grammY', GrammyContext, Context, Bot, grammyAdminCases],
  [
    'Telegraf',
    OriginalTelegrafContext,
    TelegrafContext,
    Telegraf,
    telegrafAdminCases,
  ],
];

async function outcome(ctx, name, args) {
  try {
    return { value: await ctx[name](...args) };
  } catch (error) {
    return { error: { name: error.name, message: error.message } };
  }
}

for (const [style, Reference, Owned, Constructor, cases] of styles) {
  it(`inventories pinned ${style} chat administration methods`, () => {
    assert.equal(cases.length, style === 'grammY' ? 55 : 40);
    for (const [name] of cases) {
      assert.equal(typeof Reference.prototype[name], 'function', name);
    }
  });

  for (const [name, args] of cases) {
    it(`matches actual ${style} ${name} chat, author and forum scopes`, async () => {
      const reference = contextOracle(style);
      const { bot, calls } = recordingBot(Constructor);
      const beforeArgs = globalThis.structuredClone(args);
      for (const update of Object.values(adminUpdates)) {
        const before = globalThis.structuredClone(update);
        const original = new Reference(update, reference.api, {});
        const owned = new Owned(update, bot.api, {}, bot.telegram);
        assert.deepEqual(
          await outcome(owned, name, args),
          await outcome(original, name, args)
        );
        assert.deepEqual(update, before);
      }
      assert.deepEqual(calls, reference.calls);
      assert.deepEqual(args, beforeArgs);
    });

    it(`matches actual ${style} ${name} missing-context errors without dispatch`, async () => {
      const reference = contextOracle(style);
      const { bot, calls } = recordingBot(Constructor);
      const update = { update_id: 1, inline_query: {} };
      const expected = await outcome(
        new Reference(update, reference.api, {}),
        name,
        args
      );
      assert(expected.error, name);
      assert.deepEqual(
        await outcome(new Owned(update, bot.api, {}, bot.telegram), name, args),
        expected
      );
      assert.equal(calls.length, 0);
    });
  }

  it(`forwards every ${style} administration cancellation signal`, async () => {
    const reference = contextOracle(style);
    const { bot, calls } = recordingBot(Constructor);
    const ctx = new Owned(adminUpdates.message, bot.api, {}, bot.telegram);
    const original = new Reference(ctx.update, reference.api, {});
    const signal = new globalThis.AbortController().signal;
    for (const [name, provided] of cases) {
      const args = [...provided];
      if (
        style === 'grammY' &&
        ['unpinChatMessage', 'getChatAdministrators'].includes(name)
      ) {
        args.push(undefined);
      }
      await ctx[name](...args, signal);
      assert.equal(calls.at(-1).signal, signal, name);
      assert(!('signal' in calls.at(-1).params), name);
      if (style === 'grammY') {
        await original[name](...args, signal);
      }
    }
    if (style === 'grammY') {
      assert.deepEqual(calls, reference.calls);
    }
  });

  it(`retains ${style} administration deadlines and pre-cancellation`, async () => {
    let requests = 0;
    const bot = new Constructor('admin:fixture', {
      fetch: async () => {
        requests++;
        return new Response(JSON.stringify({ ok: true, result: true }));
      },
    });
    const ctx = new Owned(adminUpdates.message, bot.api, {}, bot.telegram);
    const controller = new globalThis.AbortController();
    controller.abort(new Error('stopped'));
    for (const [name, provided] of cases) {
      const args = [...provided];
      if (
        style === 'grammY' &&
        ['unpinChatMessage', 'getChatAdministrators'].includes(name)
      ) {
        args.push(undefined);
      }
      await assert.rejects(
        ctx[name](...args, controller.signal),
        /stopped/,
        name
      );
    }
    assert.equal(requests, 0);
    const recorded = recordingBot(Constructor);
    const owned = new Owned(
      adminUpdates.message,
      recorded.bot.api,
      {},
      recorded.bot.telegram
    );
    const controls = Object.freeze({
      signal: new globalThis.AbortController().signal,
      timeout: 25,
    });
    await owned.setChatTitle('Title', controls);
    await owned.createChatInviteLink(controls);
    await owned.editForumTopic(controls);
    for (const call of recorded.calls) {
      assert.equal(call.signal, controls.signal);
      assert.equal(call.timeout, 25);
      assert(!('signal' in call.params || 'timeout' in call.params));
    }
  });

  for (const backend of [
    'native',
    'grammy',
    'telegraf',
    'node-telegram-bot-api',
  ]) {
    it(`dispatches ${style} administration through selected ${backend} HTTP`, async () => {
      const server = await uploadServer();
      try {
        const client = await selectedBotClient(
          backend,
          server.root,
          'admin:fixture'
        );
        const bot = new Constructor('admin:fixture', { api: client });
        const ctx = new Owned(adminUpdates.message, bot.api, {}, bot.telegram);
        await ctx.editForumTopic({ name: 'Edited' });
        await ctx.pinChatMessage(11);
        await ctx.getChatMembersCount();
        assert.equal(server.requests.length, 3);
        assert.deepEqual(botRequestFields(server.requests[0]), {
          chat_id: -1007,
          message_thread_id: 19,
          name: 'Edited',
        });
        assert.deepEqual(botRequestFields(server.requests[1]), {
          chat_id: -1007,
          message_id: 11,
          ...(style === 'grammY' && { business_connection_id: 'business:1' }),
        });
        assert.deepEqual(botRequestFields(server.requests[2]), {
          chat_id: -1007,
        });
        const count =
          style === 'grammY' ? 'getChatMemberCount' : 'getChatMembersCount';
        assert(server.requests[2].url.endsWith(`/${count}`));
      } finally {
        await server.close();
      }
    });
  }
}

it('preserves grammY business pin defaults, explicit overrides and alias dispatch', async () => {
  const reference = contextOracle('grammY');
  const { bot, calls } = recordingBot(Bot);
  const original = new GrammyContext(adminUpdates.message, reference.api, {});
  const ctx = new Context(adminUpdates.message, bot.api);
  const options = Object.freeze({
    business_connection_id: 'override:business',
  });
  for (const target of [original, ctx]) {
    await target.pinChatMessage(11, options);
    await target.unpinChatMessage(undefined, options);
  }
  assert.deepEqual(calls, reference.calls);
  const observations = [];
  for (const target of [original, ctx]) {
    const seen = [];
    target.banAuthor = (...args) => {
      seen.push(args);
      return 'ban';
    };
    assert.equal(target.kickAuthor(options), 'ban');
    target.getChatMemberCount = (...args) => {
      seen.push(args);
      return 7;
    };
    assert.equal(target.getChatMembersCount(), 7);
    observations.push(seen);
  }
  assert.deepEqual(observations[1], observations[0]);
});

it('preserves Telegraf assertion override order for chat and forum calls', async () => {
  const { bot } = recordingBot(Telegraf);
  const observations = [];
  for (const ctx of [
    new OriginalTelegrafContext(
      adminUpdates.message,
      { editForumTopic: () => true },
      {}
    ),
    new TelegrafContext(
      adminUpdates.message,
      bot.api,
      {},
      { editForumTopic: () => true }
    ),
  ]) {
    const calls = [];
    ctx.assert = (...args) => calls.push(args);
    await ctx.editForumTopic({ name: 'Edited' });
    observations.push(calls);
  }
  assert.deepEqual(observations[1], observations[0]);
});
