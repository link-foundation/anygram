import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as anygram from '../src/index.js';
import { Composer as GrammyComposer, Context as GrammyContext } from 'grammy';
import {
  Composer as TelegrafComposer,
  Context as TelegrafContext,
} from 'telegraf';

const update = (text) => ({
  update_id: 1,
  message: {
    message_id: 1,
    text,
    chat: { id: 7, type: 'private' },
    from: { id: 8 },
    entities: text.startsWith('/')
      ? [{ type: 'bot_command', offset: 0, length: text.split(' ')[0].length }]
      : [],
  },
});

it('composes nested middleware objects, commands and text handlers like the actual frameworks', async () => {
  const traces = [];
  for (const [Composer, Context] of [
    [anygram.Composer, anygram.Context],
    [GrammyComposer, GrammyContext],
    [TelegrafComposer, TelegrafContext],
  ]) {
    const trace = [];
    const child = new Composer();
    child.command('go', (ctx) => {
      trace.push(['go', ctx.from.id]);
    });
    const parent = new Composer(async (ctx, next) => {
      trace.push('before');
      await next();
      trace.push('after');
    });
    parent.use(child);
    parent.hears('hello', () => {
      trace.push('hello');
    });
    for (const text of ['/go argument', 'hello', 'ignored']) {
      const ctx = new Context(
        update(text),
        {},
        { id: 123, username: 'testbot' }
      );
      await parent.middleware()(ctx, async () => {
        trace.push('outside');
      });
    }
    traces.push(trace);
  }
  assert.deepEqual(traces[0], traces[1]);
  assert.deepEqual(traces[0], traces[2]);
});

it('supports a Telegraf start handler while launch controls polling', async () => {
  const bot = new anygram.Telegraf('123:offline', {
    botInfo: { id: 123, username: 'testbot' },
    fetch: () => assert.fail('offline dispatch must not connect'),
  });
  let started = 0;
  assert.equal(
    bot.start((ctx) => {
      assert.equal(ctx.me, 'testbot');
      assert.equal(ctx.botInfo.username, 'testbot');
      started++;
    }),
    bot
  );
  await bot.handleUpdate(update('/start@testbot'));
  assert.equal(started, 1);
  await bot.launch({ maxPolls: 0 });
  assert.equal(bot.isRunning(), false);
});

it('shares middleware composition with Bot and rejects repeated next calls', async () => {
  const composer = new anygram.Composer(
    async (ctx, next) => {
      await next();
      await next();
    },
    async (_ctx, next) => {
      await next();
    }
  );
  const bot = new anygram.Bot('123:offline', { botInfo: { id: 123 } });
  bot.use(composer);
  await assert.rejects(
    bot.handleUpdate(update('hello')),
    /`next` already called before!/
  );
  assert.equal(bot.seen.size, 0);
});
