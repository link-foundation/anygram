import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as original from 'grammy';
import { run as referenceRun } from '../node_modules/grammy/out/composer.js';
import * as owned from '../src/index.js';

const me = { id: 7, username: 'scopebot' };
const message = (text = 'hello') => ({
  message_id: 2,
  chat: { id: 3, type: 'private' },
  text,
  entities: [
    { type: 'bot_command', offset: 0, length: text.split(' ')[0].length },
  ],
});
const updates = [
  {},
  { message: message() },
  { channel_post: message('hello') },
  { edited_message: message('hello') },
  { message: message('/go@ScopeBot   payload') },
  { channel_post: message('/go caption') },
  { message: { ...message(), caption: 'hello', text: undefined } },
  { callback_query: { data: 'hello', game_short_name: 'hello' } },
  { inline_query: { query: 'hello' } },
  { chosen_inline_result: { result_id: 'hello' } },
  { pre_checkout_query: { invoice_payload: 'hello' } },
  { shipping_query: { invoice_payload: 'hello' } },
  {
    message_reaction: {
      chat: { id: 3, type: 'private' },
      old_reaction: [],
      new_reaction: [{ type: 'emoji', emoji: '👍' }],
    },
  },
];

async function compare(experiment) {
  assert.deepEqual(await experiment(owned), await experiment(original));
}

function entry(trace, name) {
  return async (ctx, next) => {
    trace.push([name, ctx.match]);
    await next();
    trace.push(`${name}:after`);
  };
}

async function dispatch(sdk, composer, trace, events = updates) {
  for (const [update_id, update] of events.entries()) {
    trace.push(['update', update_id]);
    await composer.middleware()(
      new sdk.Context({ update_id, ...update }, {}, me),
      async () => trace.push('outside')
    );
  }
}

const registrations = [
  ['use'],
  ['on', 'msg:text'],
  ['on', ['message:text', 'channel_post:caption']],
  ['hears', ['hello', /pay(\w+)/]],
  ['command', ['go', 'other']],
  ['reaction', '👍'],
  ['chatType', ['private']],
  ['callbackQuery', 'hello'],
  ['gameQuery', 'hello'],
  ['inlineQuery', 'hello'],
  ['chosenInlineResult', 'hello'],
  ['preCheckoutQuery', 'hello'],
  ['shippingQuery', 'hello'],
  ['filter', async (ctx) => Boolean(ctx.message)],
  ['drop', async (ctx) => Boolean(ctx.message)],
];
for (const [index, registration] of registrations.entries()) {
  it(`matches grammY returned scope and dispatch ${index}: ${registration[0]}`, async () => {
    await compare(async (sdk) => {
      const trace = [];
      const composer = new sdk.Composer(entry(trace, 'root'));
      const [name, ...args] = registration;
      const child = composer[name](...args, entry(trace, 'selected'));
      assert.notEqual(child, composer);
      assert.ok(child instanceof sdk.Composer);
      child.use(entry(trace, 'later'));
      composer.use(entry(trace, 'following'));
      await dispatch(sdk, composer, trace);
      return trace;
    });
  });
}

it('matches grammY middleware snapshots and live nested middleware objects', async () => {
  await compare(async (sdk) => {
    const trace = [];
    const child = new sdk.Composer();
    const parent = new sdk.Composer(child);
    const snapshot = parent.middleware();
    parent.use(entry(trace, 'parent-late'));
    child.use(entry(trace, 'child-late'));
    let calls = 0;
    const object = {
      middleware: () => {
        calls++;
        return entry(trace, 'object');
      },
    };
    parent.use(object);
    await snapshot(new sdk.Context({}, {}, me), async () => trace.push('end'));
    await dispatch(sdk, parent, trace, [{}, {}]);
    return { trace, calls };
  });
});

for (const factory of ['function', 'array', 'composer', 'empty']) {
  it(`matches grammY async lazy ${factory} factory and returned scope`, async () => {
    await compare(async (sdk) => {
      const trace = [];
      const composer = new sdk.Composer();
      const child = composer.lazy(async (ctx) => {
        trace.push(['factory', ctx.update.update_id]);
        const handler = entry(trace, 'generated');
        return {
          function: handler,
          array: [handler, entry(trace, 'second')],
          composer: new sdk.Composer(handler),
          empty: [],
        }[factory];
      });
      child.use(entry(trace, 'lazy-scope'));
      composer.use(entry(trace, 'following'));
      await dispatch(sdk, composer, trace, [{}, {}]);
      return trace;
    });
  });
}

for (const hasFallback of [false, true]) {
  it(`matches grammY async route, absent key and fallback ${hasFallback}`, async () => {
    await compare(async (sdk) => {
      const trace = [];
      const composer = new sdk.Composer();
      const table = { one: entry(trace, 'one'), zero: null };
      const fallback = hasFallback ? entry(trace, 'fallback') : undefined;
      const child = composer.route(
        async (ctx) => ctx.update.route,
        table,
        fallback
      );
      child.use(entry(trace, 'route-scope'));
      composer.use(entry(trace, 'following'));
      await dispatch(sdk, composer, trace, [
        {},
        { route: 'one' },
        { route: 'zero' },
        { route: 'missing' },
      ]);
      return trace;
    });
  });
}

it('matches grammY async branch selection and mutations to branch composers', async () => {
  await compare(async (sdk) => {
    const trace = [];
    const yes = new sdk.Composer(entry(trace, 'yes'));
    const no = new sdk.Composer(entry(trace, 'no'));
    const composer = new sdk.Composer();
    composer
      .branch(async (ctx) => ctx.update.accept, yes, no)
      .use(entry(trace, 'branch-scope'));
    yes.use(entry(trace, 'yes-late'));
    no.use(entry(trace, 'no-late'));
    composer.use(entry(trace, 'following'));
    await dispatch(sdk, composer, trace, [{ accept: true }, { accept: false }]);
    return trace;
  });
});

it('matches grammY fork start order, isolated next and joined completion', async () => {
  await compare(async (sdk) => {
    const trace = [];
    const composer = new sdk.Composer(entry(trace, 'root'));
    let release;
    const gate = new Promise((resolve) => {
      release = resolve;
    });
    const fork = composer.fork(async (ctx, next) => {
      trace.push('fork-before');
      await gate;
      await next();
      trace.push('fork-after');
    });
    fork.use(entry(trace, 'fork-late'));
    composer.use(async (ctx, next) => {
      trace.push('main');
      release();
      await next();
    });
    await dispatch(sdk, composer, trace, [{}]);
    trace.push('finished');
    return trace;
  });
});

for (const mode of [
  'success',
  'stop',
  'recover',
  'recover-stop',
  'outside',
  'rethrow',
  'predicate',
]) {
  it(`matches grammY error boundary isolation and continuation: ${mode}`, async () => {
    await compare(async (sdk) => {
      const trace = [];
      const reason = new TypeError('fixture failure');
      const composer = new sdk.Composer();
      const safe = composer.errorBoundary(
        async (error, next) => {
          trace.push([
            error.name,
            error.message,
            error.error === reason,
            error.ctx.update.update_id,
          ]);
          if (mode === 'rethrow') {
            throw new Error('boundary failure');
          }
          if (mode !== 'recover-stop') {
            await next();
          }
        },
        async (ctx, next) => {
          trace.push('protected');
          if (['recover', 'recover-stop', 'rethrow'].includes(mode)) {
            throw reason;
          }
          if (mode !== 'stop') {
            await next();
          }
          trace.push('protected-after');
        }
      );
      safe
        .filter(async () => {
          if (mode === 'predicate') {
            throw reason;
          }
          return true;
        })
        .use(entry(trace, 'protected-late'));
      composer.use(() => {
        trace.push('outside');
        if (mode === 'outside') {
          throw reason;
        }
      });
      try {
        await dispatch(sdk, composer, trace, [{}]);
      } catch (error) {
        trace.push(['uncaught', error.name, error.message]);
      }
      return trace;
    });
  });
}

for (const reason of [
  new TypeError('fixture'),
  'x'.repeat(60),
  7,
  7n,
  false,
  null,
  undefined,
  {},
  [],
]) {
  it(`matches grammY BotError wrapping for ${String(reason)}`, () => {
    const ctx = {};
    const result = new owned.BotError(reason, ctx);
    const expected = new original.BotError(reason, ctx);
    assert.equal(result.name, expected.name);
    assert.equal(result.message, expected.message);
    assert.equal(result.error, reason);
    assert.equal(result.ctx, ctx);
    if (reason instanceof Error) {
      assert.equal(result.stack, reason.stack);
    }
  });
}

it('exports grammY run and awaits middleware without an external next', async () => {
  await compare(async (sdk) => {
    const ctx = {};
    const trace = [];
    const result = await (sdk === owned ? sdk.run : referenceRun)(
      async (context, next) => {
        assert.equal(context, ctx);
        trace.push('before');
        await next();
        trace.push('after');
        return 3;
      },
      ctx
    );
    return { result, trace };
  });
});

it('represents every pinned grammY Composer prototype member', () => {
  const expected = Object.getOwnPropertyNames(original.Composer.prototype);
  for (const name of expected) {
    assert.equal(typeof owned.Composer.prototype[name], 'function', name);
  }
});

it('retains grammY singleton middleware identity, direct return and next errors', async () => {
  await compare(async (sdk) => {
    const handler = () => 42;
    assert.equal(new sdk.Composer(handler).middleware(), handler);
    const ctx = new sdk.Context({}, {}, me);
    const trace = [new sdk.Composer().middleware()(ctx, () => 7)];
    const bad = new sdk.Composer(
      async (_ctx, next) => {
        await next();
        await next();
      },
      async () => {}
    );
    try {
      await bad.middleware()(ctx, async () => {});
    } catch (error) {
      trace.push([error.name, error.message]);
    }
    return trace;
  });
});

it('wraps Bot catcher failures in the exported BotError while retaining cause', async () => {
  const reason = new Error('handler');
  let received;
  const bot = new owned.Bot('composer:fixture', { botInfo: me });
  bot.use(() => {
    throw reason;
  });
  bot.catch((error) => {
    received = error;
  });
  await bot.handleUpdate({ update_id: 1 });
  assert.ok(received instanceof owned.BotError);
  assert.equal(received.cause, reason);
  assert.equal(received.error, reason);
});

it('preserves Anygram catcher support for symbols without throwing during error formatting', async () => {
  const reason = Symbol('handler');
  const bot = new owned.Bot('composer:symbol', { botInfo: me });
  let received;
  bot.use(() => {
    throw reason;
  });
  bot.catch((error) => {
    received = error;
  });
  await bot.handleUpdate({ update_id: 1 });
  assert.equal(received.error, reason);
  assert.equal(received.cause, reason);
  assert.equal(
    received.message,
    'Non-error value of type symbol thrown in middleware: Symbol(handler)'
  );
});
