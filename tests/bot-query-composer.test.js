import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  Composer as OriginalComposer,
  Context as OriginalContext,
} from 'grammy';
import { Bot, Composer, Context } from '../src/index.js';

const routes = [
  ['callbackQuery', 'callback_query', 'data', 'callbackQuery'],
  ['gameQuery', 'callback_query', 'game_short_name', 'callbackQuery'],
  ['inlineQuery', 'inline_query', 'query', 'inlineQuery'],
  [
    'chosenInlineResult',
    'chosen_inline_result',
    'result_id',
    'chosenInlineResult',
  ],
  [
    'preCheckoutQuery',
    'pre_checkout_query',
    'invoice_payload',
    'preCheckoutQuery',
  ],
  ['shippingQuery', 'shipping_query', 'invoice_payload', 'shippingQuery'],
];

async function queryTrace(Implementation, ContextType, route) {
  const [method, event, field, alias] = route;
  const trace = [];
  const composer = new Implementation();
  const branch = composer[method](
    ['alpha', /^value:(\d+)$/, /global:\d+/g],
    async (ctx, next) => {
      assert.equal(ctx[alias], ctx.update[event]);
      assert.equal(ctx.from, ctx.update[event].from);
      trace.push(['matched', ctx.match]);
      await next();
      trace.push('after');
    }
  );
  assert.notEqual(branch, composer);
  branch.use(async (ctx, next) => {
    trace.push('scoped');
    await next();
  });
  composer.use(() => trace.push('following'));
  for (const value of ['alpha', 'value:42', 'global:1 global:2', 'other', '']) {
    const update = {
      update_id: 1,
      [event]: { [field]: value, from: { id: 8 } },
    };
    await composer.middleware()(new ContextType(update, {}, {}));
  }
  await composer.middleware()(new ContextType({ update_id: 2 }, {}, {}));
  return trace;
}

for (const route of routes) {
  it(`matches actual grammY ${route[0]} triggers, match values and scoped chaining`, async () => {
    assert.deepEqual(
      await queryTrace(Composer, Context, route),
      await queryTrace(OriginalComposer, OriginalContext, route)
    );
  });
}

async function filteredTrace(Implementation) {
  const trace = [];
  const composer = new Implementation();
  const branch = composer.filter(async (ctx) => {
    await Promise.resolve();
    trace.push(['predicate', ctx.state.accept]);
    return ctx.state.accept;
  });
  assert.notEqual(branch, composer);
  branch.use(async (ctx, next) => {
    trace.push('branch');
    await next();
    trace.push('branch-after');
  });
  composer.use(() => trace.push('following'));
  for (const accept of [true, false]) {
    await composer.middleware()({ state: { accept } });
  }
  return trace;
}

it('matches actual async filter predicates and later scoped registrations', async () => {
  assert.deepEqual(
    await filteredTrace(Composer),
    await filteredTrace(OriginalComposer)
  );
});

it('retains native sticky RegExp matching semantics for query triggers', async () => {
  const traces = [];
  for (const [Implementation, ContextType] of [
    [Composer, Context],
    [OriginalComposer, OriginalContext],
  ]) {
    const pattern = /\d+/y;
    pattern.lastIndex = 6;
    const matches = [];
    const composer = new Implementation();
    composer.callbackQuery(pattern, (ctx) => matches.push(ctx.match));
    for (let id = 0; id < 3; id++) {
      await composer.middleware()(
        new ContextType(
          { update_id: id, callback_query: { data: 'prefix42' } },
          {},
          {}
        ),
        () => Promise.resolve()
      );
    }
    traces.push({ matches, lastIndex: pattern.lastIndex });
  }
  assert.deepEqual(traces[0], traces[1]);
});

it('routes async filter predicate failures through the existing bot catcher', async () => {
  const reason = new Error('predicate rejected');
  const bot = new Bot('queries:fixture');
  let recovered;
  bot
    .filter(async () => {
      await Promise.resolve();
      throw reason;
    })
    .use(() => assert.fail('failed predicate admitted a handler'));
  bot.catch(({ error, ctx }) => {
    recovered = { error, update: ctx.update };
  });
  const update = { update_id: 1 };
  await bot.handleUpdate(update);
  assert.deepEqual(recovered, { error: reason, update });
  assert.equal(bot.seen.has(1), true);
});

it('checks trigger array length before reading its entries', () => {
  const triggers = new Array(1001);
  triggers[Symbol.iterator] = () => assert.fail('Oversized array was visited');
  assert.throws(
    () => new Composer().callbackQuery(triggers),
    /Query trigger limit exceeded/
  );
});

it('snapshots query trigger arrays at registration like the actual SDK', async () => {
  const traces = [];
  for (const [Implementation, ContextType] of [
    [Composer, Context],
    [OriginalComposer, OriginalContext],
  ]) {
    const triggers = ['before'];
    const matches = [];
    const composer = new Implementation();
    composer.callbackQuery(triggers, (ctx) => matches.push(ctx.match));
    triggers[0] = 'after';
    triggers.push('added');
    for (const data of ['before', 'after', 'added']) {
      await composer.middleware()(
        new ContextType({ update_id: 1, callback_query: { data } }, {}, {}),
        () => Promise.resolve()
      );
    }
    traces.push(matches);
  }
  assert.deepEqual(traces[0], traces[1]);
  assert.deepEqual(traces[0], ['before']);
});
