import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Context as GrammyContext } from 'grammy';
import { Context as OriginalTelegrafContext } from 'telegraf';
import { bold as referenceBold } from 'telegraf/format';
import {
  Bot,
  Telegraf,
  Context,
  TelegrafContext,
  InputFile,
} from '../src/index.js';
import { recordingBot, contextOracle } from './fixtures/context-oracle.js';
import { uploadServer } from './fixtures/bot-upload-server.js';
import { selectedBotClient, botRequestFields } from './fixtures/bot-client.js';
import {
  grammyActionCases,
  telegrafActionCases,
  actionUpdates,
  completeActionUpdate,
} from './fixtures/context-message-actions.js';

const styles = [
  ['grammY', GrammyContext, Context, Bot, grammyActionCases],
  [
    'Telegraf',
    OriginalTelegrafContext,
    TelegrafContext,
    Telegraf,
    telegrafActionCases,
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
  it(`inventories actual ${style} context message actions`, () => {
    assert.equal(cases.length, style === 'grammY' ? 29 : 14);
    for (const [name] of cases) {
      assert.equal(typeof Reference.prototype[name], 'function', name);
    }
  });
  for (const [name, args] of cases) {
    it(`matches actual ${style} ${name} payloads and errors across message sources`, async () => {
      const reference = contextOracle(style);
      const { bot, calls } = recordingBot(Constructor);
      const beforeArgs = globalThis.structuredClone(args);
      for (const [scope, update] of Object.entries(actionUpdates)) {
        const before = globalThis.structuredClone(update);
        assert.deepEqual(
          await outcome(
            new Owned(update, bot.api, {}, bot.telegram),
            name,
            args
          ),
          await outcome(new Reference(update, reference.api, {}), name, args),
          scope
        );
        assert.deepEqual(update, before);
      }
      assert.deepEqual(calls, reference.calls);
      assert.deepEqual(args, beforeArgs);
    });
    it(`retains ${style} ${name} public API override arguments`, async () => {
      const observations = [];
      for (const Type of [Reference, Owned]) {
        const calls = [];
        const api = new Proxy(
          {},
          {
            get:
              (_, method) =>
              (...args) => {
                calls.push({ method, args });
                return Promise.resolve(true);
              },
          }
        );
        for (const update of Object.values(actionUpdates)) {
          const ctx =
            Type === Owned
              ? new Owned(update, api, {}, api)
              : new Reference(update, api, {});
          await outcome(ctx, name, args);
        }
        observations.push(calls);
      }
      assert.deepEqual(observations[1], observations[0]);
    });
  }

  it(`forwards all ${style} message action cancellation signals`, async () => {
    const { bot, calls } = recordingBot(Constructor);
    const reference = contextOracle(style);
    const ctx = new Owned(completeActionUpdate, bot.api, {}, bot.telegram);
    const signal = new globalThis.AbortController().signal;
    for (const [name, args] of cases) {
      await ctx[name](...args, signal);
      assert.equal(calls.at(-1).signal, signal, name);
      assert(!('signal' in calls.at(-1).params), name);
      if (style === 'grammY') {
        await new Reference(completeActionUpdate, reference.api, {})[name](
          ...args,
          signal
        );
      }
    }
    if (style === 'grammY') {
      assert.deepEqual(calls, reference.calls);
    }
  });

  it(`pre-cancels all ${style} message actions without HTTP`, async () => {
    let requests = 0;
    const bot = new Constructor('actions:fixture', {
      fetch: async () => {
        requests++;
        return new Response(JSON.stringify({ ok: true, result: true }));
      },
    });
    const ctx = new Owned(completeActionUpdate, bot.api, {}, bot.telegram);
    const controller = new globalThis.AbortController();
    controller.abort(new Error('actions stopped'));
    for (const [name, args] of cases) {
      await assert.rejects(
        ctx[name](...args, controller.signal),
        /actions stopped/,
        name
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
    it(`dispatches ${style} message actions through actual selected ${backend} HTTP`, async () => {
      const server = await uploadServer();
      try {
        const client = await selectedBotClient(
          backend,
          server.root,
          'actions:fixture'
        );
        const bot = new Constructor('actions:fixture', { api: client });
        const ctx = new Owned(completeActionUpdate, bot.api, {}, bot.telegram);
        await ctx.forwardMessage(-1002, { direct_messages_topic_id: 0 });
        await ctx.react('12345', style === 'grammY' ? { is_big: true } : true);
        await ctx.deleteMessages([11, 12]);
        const inline = new Owned(
          actionUpdates.inline,
          bot.api,
          {},
          bot.telegram
        );
        await inline.editMessageText('Inline', { parse_mode: 'HTML' });
        assert.equal(server.requests.length, 4);
        assert.deepEqual(botRequestFields(server.requests[0]), {
          chat_id: -1002,
          from_chat_id: -1001,
          message_id: 11,
          direct_messages_topic_id: 0,
        });
        assert.deepEqual(botRequestFields(server.requests[1]), {
          chat_id: -1001,
          message_id: 11,
          reaction: [
            style === 'grammY'
              ? { type: 'emoji', emoji: '12345' }
              : { type: 'custom_emoji', custom_emoji_id: '12345' },
          ],
          is_big: true,
        });
        assert.deepEqual(botRequestFields(server.requests[2]), {
          chat_id: -1001,
          message_ids: [11, 12],
        });
        assert.deepEqual(botRequestFields(server.requests[3]), {
          inline_message_id: 'inline:1',
          text: 'Inline',
          parse_mode: 'HTML',
        });
      } finally {
        await server.close();
      }
    });
    it(`bounds ${style} message media preparation before selected ${backend} HTTP`, async () => {
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
          'actions:fixture'
        );
        const bot = new Constructor('actions:fixture', { api: client });
        const ctx = new Owned(actionUpdates.inline, bot.api, {}, bot.telegram);
        await assert.rejects(
          Promise.race([
            ctx.editMessageMedia(
              {
                type: 'photo',
                media: new InputFile(() => blocked, 'bounded.jpg'),
              },
              { timeout: 15 }
            ),
            new Promise((_, reject) => {
              watchdog = globalThis.setTimeout(
                () =>
                  reject(new Error('Message media exceeded fixture deadline')),
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

it('retains dynamic grammY reaction deletion and actor precedence', async () => {
  const observations = [];
  for (const Type of [GrammyContext, Context]) {
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
    for (const update of [
      actionUpdates.reaction,
      actionUpdates.actor,
      { ...actionUpdates.reaction, ...actionUpdates.sender },
      { ...actionUpdates.actor, ...actionUpdates.sender },
      { ...actionUpdates.message, ...actionUpdates.poll },
    ]) {
      const ctx = new Type(update, api, {});
      for (const suffix of ['User', 'Chat']) {
        ctx[`deleteMessageReaction${suffix}`] = (...args) => {
          calls.push({ name: suffix, args });
          return Promise.resolve('overridden');
        };
      }
      await outcome(ctx, 'deleteMessageReaction', [{ remove_recent: true }]);
      await outcome(ctx, 'deleteAllMessageReactions', [
        { remove_recent: true },
      ]);
    }
    observations.push(calls);
  }
  assert.deepEqual(observations[1], observations[0]);
});

for (const [style, Reference, Owned, Constructor] of styles) {
  it(`retains ${style} business overrides, rich edits and deletion request extensions`, async () => {
    const { bot, calls } = recordingBot(Constructor);
    const reference = contextOracle(style);
    for (const update of [
      completeActionUpdate,
      {
        ...actionUpdates.callback,
        callback_query: {
          ...actionUpdates.callback.callback_query,
          inline_message_id: '',
        },
      },
    ]) {
      const ctx = new Owned(update, bot.api, {}, bot.telegram);
      const original = new Reference(update, reference.api, {});
      for (const [name, args] of [
        [
          'editMessageText',
          [
            style === 'grammY'
              ? { rows: [{ text: 'Rich' }] }
              : referenceBold('Rich'),
            { business_connection_id: 'override', message_id: 0 },
          ],
        ],
        [
          'forwardMessage',
          [-1002, { direct_messages_topic_id: 0, message_id: 0 }],
        ],
        ['deleteMessage', style === 'grammY' ? [] : [0]],
      ]) {
        assert.deepEqual(
          await outcome(ctx, name, args),
          await outcome(original, name, args)
        );
      }
      const request = Object.freeze({
        signal: new globalThis.AbortController().signal,
        timeout: 25,
      });
      await ctx.deleteMessage(0, request);
      const extended = calls.pop();
      assert.equal(extended.params.message_id, 0);
      assert.equal(extended.signal, request.signal);
      assert.equal(extended.timeout, 25);
      assert(!('signal' in extended.params || 'timeout' in extended.params));
    }
    assert.deepEqual(calls, reference.calls);
  });
}

it('optionally traces repeated chat action failures without changing callback completion', async () => {
  const ctx = new TelegrafContext(actionUpdates.message, {}, {}, {});
  let count = 0;
  let ready;
  let watchdog;
  const traces = [];
  const reached = new Promise((resolve) => {
    ready = resolve;
  });
  ctx.sendChatAction = async () => {
    if (count++ > 0) {
      throw new Error('Repeat failed');
    }
    return true;
  };
  try {
    const result = await ctx.persistentChatAction(
      'typing',
      () =>
        Promise.race([
          reached,
          new Promise((_, reject) => {
            watchdog = globalThis.setTimeout(
              () => reject(new Error('Trace did not finish')),
              1000
            );
          }),
        ]),
      {
        intervalDuration: 2,
        onError(error) {
          traces.push(error.message);
          ready();
          throw new Error('Trace failed');
        },
      }
    );
    assert.equal(result, undefined);
    assert.deepEqual(traces, ['Repeat failed']);
  } finally {
    globalThis.clearTimeout(watchdog);
  }
});

for (const [style, Reference, Owned, Constructor, cases] of styles) {
  it(`matches ${style} message action zero identifiers and omitted public arguments`, async () => {
    const update = {
      update_id: 0,
      message: {
        message_id: 0,
        chat: { id: 0 },
        from: { id: 0 },
        receiver_user: { id: 0 },
        ephemeral_message_id: '',
        business_connection_id: '',
      },
      message_reaction: { chat: { id: 0 }, message_id: 0, user: { id: 0 } },
    };
    const { bot, calls } = recordingBot(Constructor);
    const reference = contextOracle(style);
    for (const [name, args] of cases) {
      const ctx = new Owned(update, bot.api, {}, bot.telegram);
      const original = new Reference(update, reference.api, {});
      assert.deepEqual(
        await outcome(ctx, name, args),
        await outcome(original, name, args),
        name
      );
    }
    assert.deepEqual(calls, reference.calls);
    const observations = [];
    for (const Type of [Reference, Owned]) {
      const observed = [];
      const api = new Proxy(
        {},
        {
          get:
            (_, method) =>
            (...args) => {
              observed.push({ method, args });
              return Promise.resolve(true);
            },
        }
      );
      const ctx =
        Type === Owned
          ? new Owned(update, api, {}, api)
          : new Reference(update, api, {});
      for (const [name] of cases) {
        await outcome(ctx, name, []);
      }
      observations.push(observed);
    }
    assert.deepEqual(observations[1], observations[0]);
  });

  it(`matches actual ${style} empty and mixed reaction normalization`, async () => {
    const { bot, calls } = recordingBot(Constructor);
    const reference = contextOracle(style);
    const ctx = new Owned(completeActionUpdate, bot.api, {}, bot.telegram);
    const original = new Reference(completeActionUpdate, reference.api, {});
    for (const reaction of [
      undefined,
      null,
      false,
      '',
      [],
      '1234',
      '0',
      '😀',
      ['9', 'x', { type: 'paid' }],
    ]) {
      assert.deepEqual(
        await outcome(ctx, 'react', [reaction]),
        await outcome(original, 'react', [reaction])
      );
    }
    assert.deepEqual(calls, reference.calls);
  });
}

for (const mode of [
  'repeated failure',
  'initial failure',
  'callback failure',
]) {
  it(`matches Telegraf persistent chat action cleanup after ${mode}`, async () => {
    const observations = [];
    for (const Type of [OriginalTelegrafContext, TelegrafContext]) {
      const ctx = new Type(actionUpdates.message, {}, {}, {});
      const calls = [];
      let callbackCalls = 0;
      let ready;
      const reached = new Promise((resolve) => {
        ready = resolve;
      });
      ctx.sendChatAction = async (action, extra) => {
        calls.push({ action, extra });
        if (mode === 'initial failure' || calls.length === 2) {
          throw new Error('Action failed');
        }
        if (calls.length === 3) {
          ready();
        }
        return true;
      };
      let guard;
      const bounded = new Promise((_, reject) => {
        guard = globalThis.setTimeout(
          () => reject(new Error('Persistent action did not finish')),
          1000
        );
      });
      try {
        const result = await outcome(ctx, 'persistentChatAction', [
          'typing',
          async () => {
            callbackCalls++;
            if (mode === 'callback failure') {
              throw new Error('Callback failed');
            }
            await Promise.race([reached, bounded]);
            return 'ignored callback result';
          },
          { intervalDuration: 2, message_thread_id: 0 },
        ]);
        const count = calls.length;
        await new Promise((resolve) => globalThis.setTimeout(resolve, 12));
        assert.equal(calls.length, count, 'timer is cleared');
        observations.push({ result, calls, callbackCalls });
      } finally {
        globalThis.clearTimeout(guard);
      }
    }
    assert.deepEqual(observations[1], observations[0]);
  });
}
