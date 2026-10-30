import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Context as GrammyContext } from 'grammy';
import {
  Context as OriginalTelegrafContext,
  Telegram as ReferenceTelegram,
} from 'telegraf';
import { inspect } from 'node:util';
import {
  Context,
  TelegrafContext,
  matchFilter,
  ReactionList,
  MessageReactions,
  Telegraf,
} from '../src/index.js';
import {
  filterFacts,
  filterNode,
  checkerNames,
  checkerMethod,
  checkerOutcome,
  outcome,
  me,
  chat,
  message,
  entitySources,
  textEntity,
} from './fixtures/context-filters.js';

function compareFilter(query, updates) {
  const reference = GrammyContext.has.filterQuery(query);
  const owned = Context.has.filterQuery(query);
  for (const update of updates) {
    assert.deepEqual(
      outcome(() => owned(new Context(update, {}, me))),
      outcome(() => reference(new GrammyContext(update, {}, me))),
      `${JSON.stringify(query)} ${JSON.stringify(update)}`
    );
  }
}

it('inventories all actual grammY checker factories and instance methods', () => {
  assert.deepEqual(Object.keys(GrammyContext.has), checkerNames);
  assert.deepEqual(
    Object.getOwnPropertyNames(GrammyContext.prototype).filter((name) =>
      name.startsWith('has')
    ),
    checkerNames.map(checkerMethod)
  );
});

for (const [event, child] of Object.entries(filterNode(filterFacts.root))) {
  it(`matches every pinned grammY filter path under ${event}`, () => {
    compareFilter(event, [
      {},
      { [event]: null },
      { [event]: false },
      { [event]: {} },
    ]);
    for (const [field, nested] of Object.entries(filterNode(child))) {
      compareFilter(`${event}:${field}`, [
        {},
        { [event]: {} },
        ...[undefined, null, false, 0, '', [], {}].map((value) => ({
          [event]: { [field]: value },
        })),
      ]);
      for (const leaf of Object.keys(filterNode(nested))) {
        compareFilter(`${event}:${field}:${leaf}`, [
          {},
          { [event]: { [field]: null } },
          ...[
            {},
            { [leaf]: false },
            { [leaf]: true },
            { type: leaf },
            { id: me.id },
            [null, {}, { type: leaf }],
            [null, { id: me.id }],
          ].map((value) => ({ [event]: { [field]: value } })),
        ]);
      }
    }
  });
}

for (const query of [
  ':text',
  ':caption',
  'msg',
  'edit',
  'msg:photo',
  'edit:file',
  ':new_chat_members:me',
  '::bold',
  'msg::custom_emoji',
  'message:media',
  ':file:is_video',
  'message:file:is_animated',
  'message:media:is_video',
  ['message', 'message:text'],
  ['message:entities', 'message:entities:bold'],
  ['message:text', 'channel_post:photo'],
  'msg:text:bad:discarded',
  'message:media:bad:discarded',
]) {
  it(`matches grammY shortcut/merged query ${JSON.stringify(query)}`, () => {
    const updates = [
      {},
      { message: {} },
      { message: { text: '' } },
      { channel_post: { caption: 'caption', photo: [] } },
      { edited_message: { sticker: { is_animated: true } } },
      { message: { new_chat_members: [{ id: me.id }] } },
      { message: { entities: [{ type: 'italic' }] } },
      { message: { entities: [{ type: 'bold' }] } },
      { message: { caption_entities: [{ type: 'custom_emoji' }] } },
      { message: { video: { is_video: true } } },
    ];
    const reference = outcome(() => GrammyContext.has.filterQuery(query));
    if (reference.error) {
      assert.deepEqual(
        outcome(() => Context.has.filterQuery(query)),
        reference
      );
    } else {
      compareFilter(query, updates);
    }
  });
}

for (const query of [
  [],
  '',
  ':',
  'unknown',
  'message:unknown',
  'message:text:unknown',
  'message:entities:unknown',
  'message:entities:bold:extra',
  'message:',
  'message::',
  'msg:unknown',
  'edit:unknown',
  '::unknown',
  'message:file:unknown',
  'callback_query:media',
  ':media:unknown',
  ['message', 'unknown'],
  'message:entities:bold:extra:more',
]) {
  it(`preserves grammY filter validation for ${JSON.stringify(query)}`, () => {
    assert.deepEqual(
      outcome(() => Context.has.filterQuery(query)),
      outcome(() => GrammyContext.has.filterQuery(query))
    );
  });
}

const triggerUpdates = [
  {},
  ...['message', 'channel_post', 'edited_message', 'business_message'].map(
    (event) => ({ [event]: { ...message, text: 'hello 123' } })
  ),
  { message: { ...message, caption: 'hello 123' } },
  { callback_query: { data: 'hello 123', game_short_name: 'hello 123' } },
  { inline_query: { query: 'hello 123' } },
  { chosen_inline_result: { result_id: 'hello 123' } },
  { pre_checkout_query: { invoice_payload: 'hello 123' } },
  { shipping_query: { invoice_payload: 'hello 123' } },
  { callback_query: { data: '' } },
];
for (const name of checkerNames.filter(
  (key) => !['filterQuery', 'command', 'reaction', 'chatType'].includes(key)
)) {
  it(`matches actual grammY ${name} checkers, match state and trigger order`, () => {
    for (const trigger of [
      'hello 123',
      'missing',
      '',
      /hello (\d+)/,
      /hello/g,
      ['missing', /hello (\d+)/],
      ['hello 123', /hello/],
      [],
    ]) {
      for (const update of triggerUpdates) {
        for (const staticCheck of [false, true]) {
          assert.deepEqual(
            checkerOutcome(Context, name, trigger, update, staticCheck),
            checkerOutcome(GrammyContext, name, trigger, update, staticCheck),
            `${name}: ${JSON.stringify(update)}`
          );
        }
      }
    }
  });
}

it('matches actual grammY command entities, usernames, captions and errors', () => {
  for (const commands of [
    'start',
    ['start', 'help'],
    'start@TestBot',
    '/start',
    [],
  ]) {
    for (const event of [
      'message',
      'channel_post',
      'edited_message',
      'business_message',
    ]) {
      for (const text of [
        '/start args',
        '/start@TestBot  args',
        '/start@OtherBot args',
        '/start@testbot\nargs',
        '/help',
        ' /start',
        '/Start args',
      ]) {
        for (const field of ['text', 'caption']) {
          const update = {
            [event]: {
              ...message,
              [field]: text,
              entities: [
                {
                  type: 'bot_command',
                  offset: 0,
                  length: text.split(/\s/)[0].length,
                },
              ],
            },
          };
          assert.deepEqual(
            checkerOutcome(Context, 'command', commands, update),
            checkerOutcome(GrammyContext, 'command', commands, update)
          );
        }
      }
    }
  }
  const update = {
    message: {
      ...message,
      text: '/start args',
      caption_entities: [{ type: 'bot_command', offset: 0, length: 6 }],
    },
  };
  assert.deepEqual(
    checkerOutcome(Context, 'command', 'start', update),
    checkerOutcome(GrammyContext, 'command', 'start', update)
  );
});

it('matches actual grammY newly added emoji, custom, paid and future reactions', () => {
  const emoji = { type: 'emoji', emoji: '👍' };
  const custom = { type: 'custom_emoji', custom_emoji_id: '42' };
  const paid = { type: 'paid' };
  for (const argument of ['👍', custom, paid, ['👍', custom, paid], []]) {
    for (const old_reaction of [[], [emoji], [custom], [paid]]) {
      for (const new_reaction of [
        [],
        [emoji],
        [custom],
        [paid],
        [emoji, custom],
        [{ type: 'future' }],
      ]) {
        const update = { message_reaction: { old_reaction, new_reaction } };
        assert.deepEqual(
          checkerOutcome(Context, 'reaction', argument, update),
          checkerOutcome(GrammyContext, 'reaction', argument, update)
        );
      }
    }
  }
});

it('matches grammY chat types and snapshots checker registrations', () => {
  for (const types of [
    'private',
    'supergroup',
    ['private', 'supergroup'],
    [],
  ]) {
    for (const update of [
      {},
      { message },
      { callback_query: { message } },
      { message: { ...message, chat: { ...chat, type: 'private' } } },
    ]) {
      assert.deepEqual(
        checkerOutcome(Context, 'chatType', types, update),
        checkerOutcome(GrammyContext, 'chatType', types, update)
      );
    }
  }
  for (const Type of [GrammyContext, Context]) {
    const queries = ['message:text'];
    const triggers = ['hello'];
    const predicate = Type.has.filterQuery(queries);
    const checkText = Type.has.text(triggers);
    queries[0] = 'channel_post';
    triggers[0] = 'changed';
    const ctx = new Type({ message: { ...message, text: 'hello' } }, {}, me);
    assert.equal(predicate(ctx), true);
    assert.equal(checkText(ctx), true);
  }
});

it('dispatches grammY instance helpers through public static checker hooks', () => {
  for (const Type of [GrammyContext, Context]) {
    for (const name of checkerNames) {
      const original = Type.has[name];
      const argument = ['hook'];
      let called = 0;
      try {
        Type.has[name] = (value) => (ctx) => {
          assert.equal(value, argument);
          assert.ok(ctx instanceof Type);
          called++;
          return 'hook result';
        };
        assert.equal(
          new Type({}, {}, me)[checkerMethod(name)](argument),
          'hook result'
        );
        assert.equal(called, 1);
      } finally {
        Type.has[name] = original;
      }
    }
  }
});

for (const [style, Reference, Owned] of [
  ['grammY', GrammyContext, Context],
  ['Telegraf', OriginalTelegrafContext, TelegrafContext],
]) {
  for (const [label, fields] of Object.entries(entitySources)) {
    it(`matches actual ${style} entity/text rules for ${label}`, () => {
      for (const event of [
        'message',
        'edited_message',
        'channel_post',
        'business_message',
        'callback_query',
      ]) {
        const msg = { ...message, ...fields };
        const update = {
          [event]: event === 'callback_query' ? { message: msg } : msg,
        };
        const before = globalThis.structuredClone(update);
        const reference = new Reference(update, {}, me);
        const owned = new Owned(update, {}, me);
        for (const args of [
          [],
          ['bold'],
          ['bold', 'italic'],
          [['bold', 'italic']],
          [[]],
        ]) {
          assert.deepEqual(
            outcome(() => owned.entities(...args)),
            outcome(() => reference.entities(...args))
          );
        }
        if (style === 'Telegraf') {
          assert.deepEqual(
            outcome(() => owned.text),
            outcome(() => reference.text)
          );
        }
        assert.deepEqual(update, before);
      }
    });
  }
  it(`matches actual ${style} empty and poll entity extraction`, () => {
    for (const update of [
      {},
      {
        poll: {
          explanation: 'explanation',
          explanation_entities: [textEntity],
        },
      },
      {
        message,
        poll: { explanation: 'poll', explanation_entities: [textEntity] },
      },
    ]) {
      assert.deepEqual(
        outcome(() => new Owned(update, {}, me).entities()),
        outcome(() => new Reference(update, {}, me).entities())
      );
      assert.equal(
        new Owned(update, {}, me).text,
        new Reference(update, {}, me).text
      );
    }
  });
}

it('matches Telegraf raw-update predicates, property presence and short circuits', () => {
  for (const update of [
    {},
    { message: undefined },
    { message: null },
    { message },
  ]) {
    for (const makeFilters of [
      () => 'message',
      () => ['message', 'inline_query'],
      () => (raw) => raw.message !== undefined,
      () => [
        (raw) => 'message' in raw,
        () => {
          throw new Error('late');
        },
      ],
      () => [],
      () => 'message:text',
    ]) {
      assert.deepEqual(
        outcome(() => new TelegrafContext(update, {}, me).has(makeFilters())),
        outcome(() =>
          new OriginalTelegrafContext(update, {}, me).has(makeFilters())
        )
      );
    }
  }
});

it('matches grammY reaction summaries, duplicate order and absent updates', () => {
  const emoji = { type: 'emoji', emoji: '👍' };
  const other = { type: 'emoji', emoji: '🎉' };
  const custom = { type: 'custom_emoji', custom_emoji_id: '42' };
  const paid = { type: 'paid' };
  const reactions = [
    [],
    [emoji],
    [emoji, emoji],
    [emoji, other, custom, paid],
    [custom, emoji, paid],
    [{ type: 'future' }],
  ];
  for (const old_reaction of reactions) {
    for (const new_reaction of reactions) {
      for (const update of [
        {},
        { message_reaction: { old_reaction, new_reaction } },
      ]) {
        const before = globalThis.structuredClone(update);
        assert.deepEqual(
          new Context(update, {}, me).reactions(),
          new GrammyContext(update, {}, me).reactions()
        );
        assert.deepEqual(update, before);
      }
    }
  }
});

it('matches Telegraf reaction views, indexing, filtering and dynamic updates', () => {
  const emoji = { type: 'emoji', emoji: '👍' };
  const custom = { type: 'custom_emoji', custom_emoji_id: '42' };
  const current = [emoji, emoji, custom];
  const update = {
    message_reaction: { old_reaction: [custom], new_reaction: current },
  };
  const snapshot = (view) => ({
    list: [...view],
    count: view.count,
    first: view[0],
    second: view['01'],
    negative: view[-1],
    absent: view[100],
    added: view.added.toArray(),
    removed: view.removed.toArray(),
    kept: view.kept.toArray(),
    old: view.old.toArray(),
    new: view.new.toArray(),
    filtered: view.filter((item) => item.type === 'emoji').toArray(),
    has: ['👍', '42', 'missing', emoji, custom, { type: 'paid' }].map((item) =>
      view.has(item)
    ),
  });
  for (const fields of [{}, update]) {
    const reference = new OriginalTelegrafContext(fields, {}, me);
    const owned = new TelegrafContext(fields, {}, me);
    assert.deepEqual(snapshot(owned.reactions), snapshot(reference.reactions));
    const expected = reference.reactions,
      actual = owned.reactions;
    fields.message_reaction = { old_reaction: [emoji], new_reaction: [custom] };
    assert.deepEqual(snapshot(actual), snapshot(expected));
    assert.deepEqual(snapshot(owned.reactions), snapshot(reference.reactions));
  }
});

it('matches Telegraf passport, web-app, telegram and webhook aliases', () => {
  for (const data of ['{"hello":42}', 'invalid json', 'null']) {
    const update = {
      message: {
        ...message,
        passport_data: { data: [] },
        web_app_data: { data, button_text: 'Open' },
      },
    };
    for (const fields of [{}, update, { edited_message: update.message }]) {
      const telegram = { webhookReply: false };
      const reference = new OriginalTelegrafContext(fields, telegram, me);
      const owned = new TelegrafContext(fields, {}, me, telegram);
      assert.equal(owned.tg, reference.tg);
      assert.equal(owned.passportData, reference.passportData);
      const expected = reference.webAppData,
        actual = owned.webAppData;
      assert.equal(actual?.button_text, expected?.button_text);
      assert.equal(actual?.data.text(), expected?.data.text());
      assert.deepEqual(
        outcome(() => actual?.data.json()),
        outcome(() => expected?.data.json())
      );
      owned.webhookReply = true;
      assert.equal(reference.webhookReply, true);
      reference.webhookReply = false;
      assert.equal(owned.webhookReply, false);
      const replacement = { ...me, username: 'ReplacementBot' };
      owned.botInfo = replacement;
      reference.botInfo = replacement;
      assert.equal(owned.me, reference.me);
    }
  }
});

it('bounds filter/checker registration and preserves already compiled predicates', () => {
  assert.throws(
    () => Context.has.filterQuery(Array(1001).fill('message')),
    RangeError
  );
  assert.throws(() => Context.has.filterQuery('x'.repeat(4097)), RangeError);
  assert.throws(() => Context.has.text(Array(1001).fill('x')), RangeError);
  assert.throws(
    () => new TelegrafContext({}, {}, me).has(Array(1001).fill('message')),
    RangeError
  );
  const original = Context.has.filterQuery('message:text');
  for (let index = 0; index < 140; index++) {
    // Every query is valid and has a distinct, finite cache key.
    Context.has.filterQuery([
      ...Array(index + 1).fill('message:photo'),
      'message:text',
    ]);
  }
  assert.equal(
    original(new Context({ message: { text: 'still valid' } }, {}, me)),
    true
  );
});

it('exposes the standalone filter compiler and every pinned context member', () => {
  const ctx = new Context({ message: { text: 'hello' } }, {}, me);
  assert.equal(matchFilter(':text')(ctx), true);
  for (const [Reference, Owned] of [
    [GrammyContext, Context],
    [OriginalTelegrafContext, TelegrafContext],
  ]) {
    for (const name of Object.getOwnPropertyNames(Reference.prototype)) {
      if (name !== 'me') {
        assert.ok(name in Owned.prototype, `Missing ${Reference.name}.${name}`);
      }
    }
  }
});

it('snapshots reaction registrations and supports factory filter overrides', () => {
  for (const Type of [GrammyContext, Context]) {
    const reaction = { type: 'custom_emoji', custom_emoji_id: '42' };
    const accepts = Type.has.reaction(reaction);
    reaction.custom_emoji_id = 'changed';
    const update = {
      message_reaction: {
        old_reaction: [],
        new_reaction: [{ type: 'custom_emoji', custom_emoji_id: '42' }],
      },
    };
    assert.equal(accepts(new Type(update, {}, me)), true);
    const original = Type.has.filterQuery;
    const filters = [];
    try {
      Type.has.filterQuery = (query) => {
        filters.push(query);
        return () => false;
      };
      const ctx = new Type({}, {}, me);
      assert.equal(Type.has.text('hello')(ctx), false);
      assert.equal(Type.has.command('start')(ctx), false);
      assert.equal(Type.has.reaction('👍')(ctx), false);
      assert.equal(Type.has.callbackQuery('data')(ctx), false);
      assert.deepEqual(filters, [
        [':text', ':caption'],
        ':entities:bot_command',
        'message_reaction',
        'callback_query:data',
      ]);
    } finally {
      Type.has.filterQuery = original;
    }
  }
});

it('preserves Telegraf reaction list object identities, copies and inspection', () => {
  const emoji = { type: 'emoji', emoji: '👍' };
  const custom = { type: 'custom_emoji', custom_emoji_id: '42' };
  const update = {
    message_reaction: { old_reaction: [], new_reaction: [emoji, custom] },
  };
  const reference = new OriginalTelegrafContext(update, {}, me).reactions;
  const ctx = new TelegrafContext(update, {}, me);
  const view = MessageReactions.from(ctx);
  assert.ok(view instanceof MessageReactions);
  assert.ok(view instanceof ReactionList);
  assert.equal(view[0], emoji);
  const copy = view.toArray();
  copy.pop();
  assert.equal(view.count, 2);
  assert.equal(view[1], custom);
  assert.equal(inspect(view), inspect(reference));
  assert.equal(inspect(view.old), inspect(reference.old));
  assert.equal(ReactionList.has([custom], '42'), true);
  assert.equal(ReactionList.fromArray().count, 0);
});

it('keeps webhook reply control data out of dynamic Bot API method dispatch', () => {
  const bot = new Telegraf('context:fixture');
  const telegram = new ReferenceTelegram('context:fixture');
  const ctx = new TelegrafContext({}, bot.api, me, bot.telegram);
  assert.equal(ctx.webhookReply, telegram.webhookReply);
  ctx.webhookReply = false;
  assert.equal(bot.telegram.webhookReply, false);
  assert.equal(ctx.tg.webhookReply, false);
});
