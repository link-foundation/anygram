import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Composer as Reference, Context as ReferenceContext } from 'telegraf';
import * as owned from '../src/index.js';

const me = { id: 9, username: 'scopebot' };
const msg = (text, extra = {}) => ({
  message_id: 3,
  chat: { id: 4, type: 'private' },
  from: { id: 5 },
  text,
  entities: text.startsWith('/')
    ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }]
    : [],
  ...extra,
});
const updates = [
  {},
  { message: msg('hello') },
  { channel_post: msg('hello') },
  { edited_message: msg('hello') },
  { callback_query: { data: 'hello' } },
  { callback_query: { game_short_name: 'game' } },
  { inline_query: { query: 'hello' } },
  { message: msg('/go@ScopeBot   alpha "two words"') },
  { message: msg('/start payload') },
  { message: msg('/help') },
  { message: msg('/settings') },
  {
    message: msg('bold', {
      entities: [{ type: 'bold', offset: 0, length: 4 }],
    }),
  },
  {
    message_reaction: {
      old_reaction: [{ type: 'emoji', emoji: '👎' }],
      new_reaction: [{ type: 'emoji', emoji: '👍' }],
    },
  },
];

function handler(trace, name) {
  return async (ctx, next) => {
    trace.push([
      name,
      ctx.match,
      ctx.command,
      ctx.payload,
      ctx.args,
      ctx.startPayload,
    ]);
    await next();
    trace.push(`${name}:after`);
  };
}

async function compare(experiment) {
  assert.deepEqual(
    await experiment(owned.TelegrafComposer, owned.TelegrafContext),
    await experiment(Reference, ReferenceContext)
  );
}

async function dispatch(composer, Context, trace, events = updates) {
  for (const [update_id, event] of events.entries()) {
    trace.push(['update', update_id]);
    const ctx = new Context({ update_id, ...event }, {}, me);
    await composer.middleware()(ctx, async () => trace.push('outside'));
  }
}

for (const registration of [
  ['use'],
  ['on', 'text'],
  ['on', ['message', 'callback_query']],
  ['on', (update) => 'inline_query' in update],
  ['guard', (update) => Boolean(update.message)],
  ['hears', ['hello', /bold/g]],
  ['command', ['go', /^help$/]],
  ['action', ['hello', /game/]],
  ['inlineQuery', /hello/],
  ['gameQuery'],
  ['reaction', ['-👎', '👍']],
  ['entity', ['bold', 'italic']],
  ['start'],
  ['help'],
  ['settings'],
]) {
  it(`matches Telegraf fluent registration ${String(registration[0])} ${String(registration[1])}`, async () => {
    await compare(async (Composer, Context) => {
      const trace = [];
      const composer = new Composer(handler(trace, 'root'));
      const [name, ...args] = registration;
      assert.equal(
        composer[name](...args, handler(trace, 'selected')),
        composer
      );
      composer.use(handler(trace, 'later'));
      await dispatch(composer, Context, trace);
      return trace;
    });
  });
}

for (const name of ['filter', 'drop']) {
  it(`matches Telegraf global ${name} behavior and async predicates`, async () => {
    await compare(async (Composer, Context) => {
      const trace = [];
      const composer = new Composer();
      assert.equal(
        composer[name](async (ctx) => Boolean(ctx.message)),
        composer
      );
      composer.use(handler(trace, 'selected'));
      await dispatch(composer, Context, trace);
      return trace;
    });
  });
}

for (const [name, argument] of [
  ['fork', undefined],
  ['tap', undefined],
  ['optional', true],
  ['optional', false],
  ['optional', async (ctx) => Boolean(ctx.message)],
  ['branch', true],
  ['branch', false],
  ['branch', async (ctx) => Boolean(ctx.message)],
  ['lazy', undefined],
  ['dispatch', undefined],
  ['catch', undefined],
  ['chatType', ['private', 'supergroup']],
  ['privateChat', undefined],
  ['groupChat', undefined],
  ['acl', [5]],
]) {
  it(`matches Telegraf static ${name} middleware ${String(argument)}`, async () => {
    await compare(async (Composer, Context) => {
      const trace = [];
      const active = handler(trace, 'active');
      const fallback = handler(trace, 'fallback');
      let middleware;
      if (name === 'branch') {
        middleware = Composer.branch(argument, active, fallback);
      } else if (name === 'lazy') {
        middleware = Composer.lazy(async () => new Composer(active));
      } else if (name === 'dispatch') {
        middleware = Composer.dispatch(async (ctx) => Boolean(ctx.message), {
          true: active,
          false: fallback,
        });
      } else if (name === 'catch') {
        middleware = Composer.catch(
          (error, ctx) =>
            trace.push(['caught', error.message, ctx.update.update_id]),
          async () => {
            throw new Error('fixture');
          }
        );
      } else {
        middleware =
          argument === undefined
            ? Composer[name](active)
            : Composer[name](argument, active);
      }
      const composer = new Composer(middleware, handler(trace, 'following'));
      await dispatch(composer, Context, trace);
      return trace;
    });
  });
}

for (const [name, type, value] of [
  ['email', 'email', 'a@b.test'],
  ['phone', 'phone_number', '+1234'],
  ['url', 'url', 'https://test.invalid'],
  ['textLink', 'text_link', 'label'],
  ['textMention', 'text_mention', 'person'],
  ['mention', 'mention', '@person'],
  ['hashtag', 'hashtag', '#topic'],
  ['cashtag', 'cashtag', '$USD'],
  ['spoiler', 'spoiler', 'secret'],
]) {
  it(`matches Telegraf ${name} trigger and middleware-only overloads`, async () => {
    await compare(async (Composer, Context) => {
      const trace = [];
      const composer = new Composer();
      composer[name](handler(trace, 'any'));
      composer[name](value.replace(/^[@#$]/, ''), handler(trace, 'exact'));
      composer[name](/.+/g, handler(trace, 'regex'));
      const entity = { type, offset: 2, length: value.length };
      await dispatch(composer, Context, trace, [
        { message: msg(`x ${value}`, { entities: [entity] }) },
        { channel_post: { caption: `x ${value}`, caption_entities: [entity] } },
        { edited_message: msg(`x ${value}`, { entities: [entity] }) },
      ]);
      return trace;
    });
  });
}

const payloads = [
  '',
  '  leading   spaces',
  'one "two words" three',
  "one 'two words' three",
  'one\\ two three',
  'one\ntwo',
  'one\ttwo',
  '"unclosed words',
  "a'b c'd",
  '"a\'b"',
  'one\\',
  '"" \'\' last',
];
for (const payload of payloads) {
  it(`matches Telegraf command payload and lazy args ${JSON.stringify(payload)}`, async () => {
    await compare(async (Composer, Context) => {
      const trace = [];
      const composer = new Composer();
      composer.command('go', async (ctx, next) => {
        const first = ctx.args;
        assert.equal(ctx.args, first);
        trace.push([ctx.payload, first]);
        ctx.args = ['override'];
        trace.push(ctx.args);
        await next();
      });
      await dispatch(composer, Context, trace, [
        { message: msg(`/go ${payload}`) },
      ]);
      return trace;
    });
  });
}

it('matches Telegraf text-link/mention argument boundaries and entities predicate hooks', async () => {
  await compare(async (Composer, Context) => {
    const trace = [];
    const text = '/go before First Last after';
    const entity = {
      type: 'text_mention',
      offset: 11,
      length: 10,
      user: { id: 8 },
    };
    const composer = new Composer();
    composer.command('go', handler(trace, 'command'));
    composer.entity(
      (entry, value, ctx) => {
        trace.push([entry.type, value, ctx.update.update_id]);
        return entry.type === 'text_mention';
      },
      handler(trace, 'entity')
    );
    await dispatch(composer, Context, trace, [
      { message: msg(text, { entities: [msg(text).entities[0], entity] }) },
    ]);
    return trace;
  });
});

it('matches Telegraf function triggers, regex resets and invalid registration errors', async () => {
  await compare(async (Composer, Context) => {
    const trace = [];
    const composer = new Composer();
    const pattern = /hello/g;
    pattern.lastIndex = 4;
    composer.hears(
      [
        (text, ctx) => text === 'hello' && ['custom', ctx.update.update_id],
        pattern,
      ],
      handler(trace, 'trigger')
    );
    await dispatch(composer, Context, trace);
    for (const trigger of ['', null, false]) {
      try {
        composer.hears(trigger, handler(trace, 'invalid'));
      } catch (error) {
        trace.push([error.name, error.message]);
      }
    }
    return trace;
  });
});

it('matches Telegraf static logging, reply, status and nested compose utilities', async () => {
  await compare(async (Composer, Context) => {
    const trace = [];
    const ctx = new Context({ message: msg('hello') }, {}, me);
    ctx.reply = (...args) => trace.push(['reply', args]);
    ctx.getChatMember = async (id) => {
      trace.push(['member', id]);
      return { status: 'administrator' };
    };
    const composer = new Composer(
      Composer.log((text) => trace.push(['log', text])),
      Composer.admin(handler(trace, 'admin')),
      Composer.creator(handler(trace, 'creator')),
      Composer.reply('hello', { disable_notification: true })
    );
    await Composer.unwrap(composer)(ctx, Composer.passThru());
    return trace;
  });
});

it('represents every pinned Telegraf Composer static and instance member', () => {
  for (const name of Object.getOwnPropertyNames(Reference.prototype)) {
    assert.equal(
      typeof owned.TelegrafComposer.prototype[name],
      'function',
      name
    );
  }
  for (const name of Object.getOwnPropertyNames(Reference)) {
    if (typeof Reference[name] === 'function') {
      assert.equal(typeof owned.TelegrafComposer[name], 'function', name);
    }
  }
});

it('matches Telegraf compose context replacement and dynamic middleware objects', async () => {
  await compare(async (Composer, Context) => {
    const trace = [];
    let calls = 0;
    const replacement = new Context({ message: msg('replacement') }, {}, me);
    const middleware = Composer.compose([
      async (ctx, next) => {
        trace.push(ctx.message.text);
        await next(replacement);
      },
      {
        middleware: () => {
          calls++;
          return handler(trace, 'dynamic');
        },
      },
    ]);
    await middleware(
      new Context({ message: msg('original') }, {}, me),
      async () => trace.push('end')
    );
    return { trace, calls };
  });
});

for (const scenario of [
  'invalid-context',
  'repeated-next',
  'missing-route',
  'undefined-handler',
  'not-array',
  'invalid-factory',
  'sync-catch',
]) {
  it(`matches Telegraf composition errors: ${scenario}`, async () => {
    await compare(async (Composer, Context) => {
      const ctx = new Context({}, {}, me);
      try {
        if (scenario === 'invalid-context') {
          await Composer.compose([(_ctx, next) => next({}), async () => {}])(
            ctx,
            async () => {}
          );
        } else if (scenario === 'repeated-next') {
          await Composer.compose([
            async (_ctx, next) => {
              await next();
              await next();
            },
            async () => {},
          ])(ctx, async () => {});
        } else if (scenario === 'missing-route') {
          await Composer.dispatch(() => 'missing', {})(ctx, async () => {});
        } else if (scenario === 'undefined-handler') {
          Composer.unwrap(undefined);
        } else if (scenario === 'not-array') {
          Composer.compose({});
        } else if (scenario === 'invalid-factory') {
          Composer.lazy(false);
        } else {
          await Composer.catch(
            () => assert.fail('SDK synchronous singleton throw bypasses catch'),
            () => {
              throw new Error('synchronous');
            }
          )(ctx, async () => {});
        }
        assert.fail('expected SDK error');
      } catch (error) {
        return [error.name, error.message];
      }
    });
  });
}

it('matches Telegraf reaction additions, removals, object triggers and first matching choice', async () => {
  await compare(async (Composer, Context) => {
    const trace = [];
    const composer = new Composer();
    composer.reaction(['-👎', '👍'], handler(trace, 'first'));
    composer.reaction(
      { type: 'custom_emoji', custom_emoji_id: '42' },
      handler(trace, 'custom')
    );
    await dispatch(composer, Context, trace, [
      {
        message_reaction: {
          old_reaction: [{ type: 'emoji', emoji: '👎' }],
          new_reaction: [{ type: 'emoji', emoji: '👍' }],
        },
      },
      {
        message_reaction: {
          old_reaction: [],
          new_reaction: [{ type: 'custom_emoji', custom_emoji_id: '42' }],
        },
      },
      {
        message_reaction: {
          old_reaction: [{ type: 'emoji', emoji: '👍' }],
          new_reaction: [{ type: 'emoji', emoji: '👍' }],
        },
      },
    ]);
    return trace;
  });
});

it('shares fluent registrations and static helpers with the selected Telegraf bot runner', async () => {
  const bot = new owned.Telegraf('composer:fixture', { botInfo: me });
  const trace = [];
  assert.equal(
    bot.use(owned.Telegraf.optional(true, handler(trace, 'optional'))),
    bot
  );
  assert.equal(bot.start(handler(trace, 'start')), bot);
  assert.equal(bot.on('text', handler(trace, 'text')), bot);
  await bot.handleUpdate({ update_id: 1, message: msg('/start payload') });
  assert.equal(trace[1][0], 'start');
  assert.equal(trace[1][5], 'payload');
  assert.equal(trace[2][0], 'text');
});

it('matches Telegraf tap return isolation and entity registration snapshots', async () => {
  await compare(async (Composer, Context) => {
    const trace = [];
    const types = ['bold'];
    const composer = new Composer(Composer.tap(() => 42));
    composer.entity(types, handler(trace, 'entity'));
    types[0] = 'italic';
    await dispatch(composer, Context, trace, [
      {
        message: msg('bold', {
          entities: [{ type: 'bold', offset: 0, length: 4 }],
        }),
      },
      {
        message: msg('italic', {
          entities: [{ type: 'italic', offset: 0, length: 6 }],
        }),
      },
    ]);
    return trace;
  });
});

it('matches Telegraf lazy argument capture when middleware replaces message entities', async () => {
  await compare(async (Composer, Context) => {
    const trace = [];
    const composer = new Composer();
    composer.command('go', (ctx) => {
      ctx.message.entities = [];
      trace.push(ctx.args);
    });
    await dispatch(composer, Context, trace, [
      {
        message: msg('/go First Last', {
          entities: [
            msg('/go').entities[0],
            {
              type: 'text_link',
              offset: 4,
              length: 10,
              url: 'https://example.test',
            },
          ],
        }),
      },
    ]);
    return trace;
  });
});

for (const [name, event, field] of [
  ['callbackQuery', 'callback_query', 'data'],
  ['chosenInlineResult', 'chosen_inline_result', 'result_id'],
  ['preCheckoutQuery', 'pre_checkout_query', 'invoice_payload'],
  ['shippingQuery', 'shipping_query', 'invoice_payload'],
]) {
  it(`preserves Anygram's scoped Telegraf ${name} extension`, async () => {
    const composer = new owned.TelegrafComposer();
    const trace = [];
    const child = composer[name]('selected', handler(trace, 'selected'));
    assert.notEqual(child, composer);
    child.use(handler(trace, 'scope'));
    composer.use(handler(trace, 'following'));
    await dispatch(composer, owned.TelegrafContext, trace, [
      { [event]: { [field]: 'selected' } },
      { [event]: { [field]: 'other' } },
    ]);
    assert.equal(trace.filter((item) => item[0] === 'selected').length, 1);
    assert.equal(trace.filter((item) => item[0] === 'scope').length, 1);
    assert.equal(trace.filter((item) => item[0] === 'following').length, 2);
  });
}
