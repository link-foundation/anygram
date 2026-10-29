import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Context as GrammyContext } from 'grammy';
import { Context as OriginalTelegrafContext } from 'telegraf';
import { Context, TelegrafContext, Bot, Telegraf } from '../src/index.js';
import { uploadServer } from './fixtures/bot-upload-server.js';
import { selectedBotClient, botRequestFields } from './fixtures/bot-client.js';

const chat = { id: -1007, type: 'supergroup' };
const from = { id: 8, first_name: 'sender' };
const user = { id: 9, first_name: 'actor' };
const message = {
  message_id: 11,
  date: 1,
  chat,
  from,
  sender_chat: { id: -1008, type: 'channel' },
  business_connection_id: 'business:1',
};
const fixtures = {
  message,
  edited_message: message,
  channel_post: message,
  edited_channel_post: message,
  business_connection: { id: 'business:1', user, user_chat_id: 9 },
  business_message: message,
  edited_business_message: message,
  deleted_business_messages: { business_connection_id: 'business:1', chat },
  guest_message: message,
  stopped_message_generation: { chat },
  message_reaction: {
    chat,
    message_id: 12,
    user,
    old_reaction: [],
    new_reaction: [],
  },
  message_reaction_count: { chat, message_id: 13, reactions: [] },
  inline_query: { id: 'inline:1', from, query: 'query' },
  chosen_inline_result: {
    result_id: 'result:1',
    from,
    inline_message_id: 'inline:2',
  },
  callback_query: { id: 'callback:1', from, message },
  shipping_query: { id: 'shipping:1', from, invoice_payload: 'order' },
  pre_checkout_query: { id: 'checkout:1', from, invoice_payload: 'order' },
  poll: { id: 'poll:1', question: 'Question?' },
  poll_answer: { poll_id: 'poll:1', user, option_ids: [0] },
  my_chat_member: { chat, from },
  chat_member: { chat, from },
  managed_bot: { user },
  chat_join_request: { chat, from },
  chat_boost: { chat, boost: { source: { source: 'premium', user } } },
  removed_chat_boost: { chat, source: { source: 'premium', user } },
  purchased_paid_media: { from, paid_media_payload: 'purchase:1' },
  subscription: { user },
};

const styles = [
  ['grammY', GrammyContext, Context],
  ['Telegraf', OriginalTelegrafContext, TelegrafContext],
];
const aggregateKeys = [
  'msg',
  'chat',
  'from',
  'senderChat',
  'msgId',
  'inlineMessageId',
];
const alias = (event) =>
  event.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
const plain = (value) =>
  value === undefined ? undefined : JSON.parse(JSON.stringify(value));

function snapshot(ctx, style) {
  const keys =
    style === 'grammY'
      ? [...aggregateKeys, 'chatId', 'businessConnectionId']
      : aggregateKeys;
  return Object.fromEntries(keys.map((key) => [key, plain(ctx[key])]));
}

function contexts(update, Reference, Owned) {
  return [new Reference(update, {}, {}), new Owned(update, {}, {})];
}

for (const [style, Reference, Owned] of styles) {
  it(`inventories every actual ${style} direct update alias`, () => {
    const ctx = new Reference(fixtures, {}, {});
    const names = Object.getOwnPropertyNames(Reference.prototype).filter(
      (name) => {
        if (aggregateKeys.includes(name)) {
          return false;
        }
        if (!Object.getOwnPropertyDescriptor(Reference.prototype, name)?.get) {
          return false;
        }
        return Object.values(fixtures).some((value) => ctx[name] === value);
      }
    );
    assert.equal(names.length, style === 'grammY' ? 27 : 18);
    const owned = new Owned(fixtures, {}, {});
    for (const name of names) {
      assert.equal(owned[name], ctx[name], name);
    }
  });

  for (const [event, value] of Object.entries(fixtures)) {
    if (!(alias(event) in Reference.prototype)) {
      continue;
    }
    it(`matches actual ${style} aliases and aggregate sources for ${event}`, () => {
      const update = {
        update_id: 1,
        [event]: globalThis.structuredClone(value),
      };
      const before = globalThis.structuredClone(update);
      const [reference, owned] = contexts(update, Reference, Owned);
      assert.equal(owned[alias(event)], update[event]);
      assert.deepEqual(snapshot(owned, style), snapshot(reference, style));
      assert.deepEqual(update, before);
    });
  }

  for (const [name, fields] of [
    ['empty updates', {}],
    [
      'callback and edited channel messages',
      {
        edited_channel_post: message,
        callback_query: {
          id: 'callback:2',
          from: user,
          message: { ...message, message_id: 22 },
        },
      },
    ],
    [
      'whole-object source precedence',
      { message: { message_id: 31 }, chat_member: { chat, from } },
    ],
    [
      'inline fallback precedence',
      {
        callback_query: { id: 'callback:3', from },
        chosen_inline_result: fixtures.chosen_inline_result,
      },
    ],
    [
      'zero identifiers',
      { message_reaction_count: { chat: { id: 0 }, message_id: 0 } },
    ],
  ]) {
    it(`matches actual ${style} aggregate semantics for ${name}`, () => {
      const [reference, owned] = contexts(
        { update_id: 1, ...fields },
        Reference,
        Owned
      );
      assert.deepEqual(snapshot(owned, style), snapshot(reference, style));
    });
  }
}

it('retains Telegraf message helpers without changing the incoming object', () => {
  for (const date of [undefined, 0, 1]) {
    const msg = Object.freeze({ ...message, date, from: null });
    const [reference, owned] = contexts(
      { update_id: 1, message: msg },
      OriginalTelegrafContext,
      TelegrafContext
    );
    assert.notEqual(owned.msg, msg);
    assert.notEqual(owned.msg, owned.msg);
    assert.equal(
      owned.msg.has('from', 'caption'),
      reference.msg.has('from', 'caption')
    );
    assert.equal(owned.msg.has('chat'), true);
    assert.equal(owned.msg.isAccessible(), reference.msg.isAccessible());
    assert.equal(Object.getPrototypeOf(msg), Object.prototype);
  }
});

for (const backend of [
  'native',
  'grammy',
  'telegraf',
  'node-telegram-bot-api',
]) {
  it(`routes business and reaction contexts through actual ${backend} HTTP`, async () => {
    const server = await uploadServer({ maxRequests: 3 });
    const token = 'context-data:fixture';
    try {
      const api = await selectedBotClient(backend, server.root, token);
      const bot = new Bot(token, { api });
      bot.on('business_message', async (ctx) => {
        assert.equal(ctx.businessConnectionId, 'business:1');
        assert.equal(ctx.from.id, 8);
        await ctx.api.sendMessage(ctx.chatId, 'business reply', {
          business_connection_id: ctx.businessConnectionId,
        });
      });
      await bot.handleUpdate({ update_id: 1, business_message: message });
      for (const Constructor of [Bot, Telegraf]) {
        const reactionBot = new Constructor(token, { api });
        reactionBot.on('message_reaction', async (ctx) => {
          assert.equal(ctx.msgId, 12);
          assert.equal(ctx.from.id, 9);
          await ctx.api.raw.setMessageReaction({
            chat_id: ctx.chatId,
            message_id: ctx.msgId,
            reaction: [],
          });
        });
        await reactionBot.handleUpdate({
          update_id: 2,
          message_reaction: fixtures.message_reaction,
        });
      }
      assert.deepEqual(
        server.requests.map((request) => ({
          method: request.url.split('/').at(-1),
          params: botRequestFields(request),
        })),
        [
          {
            method: 'sendMessage',
            params: {
              chat_id: -1007,
              text: 'business reply',
              business_connection_id: 'business:1',
            },
          },
          ...Array.from({ length: 2 }, () => ({
            method: 'setMessageReaction',
            params: { chat_id: -1007, message_id: 12, reaction: [] },
          })),
        ]
      );
    } finally {
      await server.close();
    }
  });
}
