import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as anygram from '../src/index.js';
import {
  Scenes as ReferenceScenes,
  Telegraf as ReferenceBot,
  session as referenceSession,
} from 'telegraf';

const info = { id: 123, is_bot: true, username: 'testbot', first_name: 'Test' };
const update = (id, text) => ({
  update_id: id,
  message: {
    message_id: id,
    text,
    chat: { id: 7, type: 'private' },
    from: { id: 8 },
    entities: text.startsWith('/')
      ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }]
      : [],
  },
});

it('matches actual Telegraf wizard entry, steps, state, leave and reconstructed bots', async () => {
  const traces = [];
  for (const [Scenes, Bot, session] of [
    [anygram.Scenes, anygram.Telegraf, anygram.telegrafSession],
    [ReferenceScenes, ReferenceBot, referenceSession],
  ]) {
    const store = new Map();
    const trace = [];
    const makeBot = () => {
      const bot = new Bot('123:offline');
      bot.botInfo = info;
      const wizard = new Scenes.WizardScene(
        'greeting',
        (ctx) => {
          trace.push(['ask', ctx.wizard.cursor, ctx.scene.state.seed]);
          ctx.wizard.next();
        },
        async (ctx) => {
          trace.push(['answer', ctx.message.text, ctx.wizard.state.seed]);
          await ctx.scene.leave();
        }
      );
      wizard.enter((ctx, next) => {
        trace.push('enter');
        return next();
      });
      wizard.leave(() => {
        trace.push('leave');
      });
      const stage = new Scenes.Stage([wizard]);
      bot.use(session({ store, defaultSession: () => ({}) }));
      bot.use(stage.middleware());
      bot.start((ctx) => ctx.scene.enter('greeting', { seed: 42 }));
      bot.on('message', (ctx) => {
        trace.push(['outside', ctx.message.text]);
      });
      return bot;
    };
    await makeBot().handleUpdate(update(1, '/start'));
    assert.equal(store.get('8:7').__scenes.cursor, 1);
    await makeBot().handleUpdate(update(2, 'Alice'));
    await makeBot().handleUpdate(update(3, 'outside'));
    traces.push(trace);
  }
  assert.deepEqual(traces[0], traces[1]);
  assert.deepEqual(traces[0], [
    'enter',
    ['ask', 0, 42],
    ['answer', 'Alice', 42],
    'leave',
    ['outside', 'outside'],
  ]);
});

it('expires persisted scenes and lets unhandled updates continue like actual Telegraf', async () => {
  for (const [Scenes, Bot, session] of [
    [anygram.Scenes, anygram.Telegraf, anygram.telegrafSession],
    [ReferenceScenes, ReferenceBot, referenceSession],
  ]) {
    const store = new Map([
      [
        '8:7',
        { __scenes: { current: 'old', expires: 0, state: { secret: 'old' } } },
      ],
    ]);
    const scene = new Scenes.BaseScene('old');
    scene.use(() => assert.fail('Expired scene executed'));
    const bot = new Bot('123:offline');
    bot.botInfo = info;
    bot.use(session({ store, defaultSession: () => ({}) }));
    bot.use(new Scenes.Stage([scene]).middleware());
    let continued = false;
    bot.use((ctx) => {
      continued = true;
      assert.equal(ctx.scene.current, undefined);
      assert.deepEqual(ctx.scene.state, {});
    });
    await bot.handleUpdate(update(1, 'hello'));
    assert(continued);
  }
});

it('rejects unknown scenes and bounds repeated scene transitions within one update', async () => {
  const looping = new anygram.Scenes.BaseScene('loop');
  let transitions = 0;
  looping.enter((ctx) => {
    assert(++transitions <= 9, 'Test exceeded its finite transition bound');
    return ctx.scene.enter('loop');
  });
  const bot = new anygram.Telegraf('123:offline', { botInfo: info });
  bot.use(anygram.telegrafSession({ defaultSession: () => ({}) }));
  bot.use(
    new anygram.Scenes.Stage([looping], { maxTransitions: 8 }).middleware()
  );
  bot.start((ctx) => ctx.scene.enter('loop'));
  await assert.rejects(
    bot.handleUpdate(update(1, '/start')),
    /transition limit/i
  );
  const other = new anygram.Telegraf('123:offline', { botInfo: info });
  other.use(anygram.telegrafSession({ defaultSession: () => ({}) }));
  other.use(new anygram.Scenes.Stage([]).middleware());
  other.start((ctx) => ctx.scene.enter('unknown'));
  await assert.rejects(
    other.handleUpdate(update(1, '/start')),
    /scene.*unknown/i
  );
});

it('matches silent entry and reentry while accepting middleware objects for scene hooks', async () => {
  const traces = [];
  for (const [Scenes, Bot, session] of [
    [anygram.Scenes, anygram.Telegraf, anygram.telegrafSession],
    [ReferenceScenes, ReferenceBot, referenceSession],
  ]) {
    const trace = [];
    const scene = new Scenes.BaseScene('room');
    scene.enter(
      new anygram.Composer((ctx) => {
        trace.push(['enter', ctx.scene.state.value]);
      })
    );
    scene.leave(
      new anygram.Composer(() => {
        trace.push('leave');
      })
    );
    scene.use((ctx, next) => {
      if (ctx.message.text === 'again') {
        return ctx.scene.reenter();
      }
      return next();
    });
    const bot = new Bot('123:offline');
    bot.botInfo = info;
    bot.use(session({ defaultSession: () => ({}) }));
    bot.use(new Scenes.Stage([scene]).middleware());
    bot.start((ctx) => ctx.scene.enter('room', { value: 42 }, true));
    bot.use(() => {
      trace.push('outside');
    });
    await bot.handleUpdate(update(1, '/start'));
    await bot.handleUpdate(update(2, 'again'));
    await bot.handleUpdate(update(3, 'unhandled'));
    traces.push(trace);
  }
  assert.deepEqual(traces[0], traces[1]);
  assert.deepEqual(traces[0], ['leave', ['enter', 42], 'outside']);
});
