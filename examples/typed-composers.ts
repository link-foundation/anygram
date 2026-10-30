import {
  Composer,
  Bot,
  Telegraf,
  TelegrafComposer,
  BotError,
  type Context,
  type TelegrafContext,
} from '../src/index.js';

const scoped = new Composer();
scoped
  .on('msg:text')
  .hears(['hello', /hi/])
  .use(async (ctx, next) => {
    await ctx.reply('scoped greeting');
    await next();
  });
scoped.command(['start', 'help'], async (ctx) => {
  const payload: string | RegExpMatchArray | undefined = ctx.match;
  await ctx.reply(String(payload));
});
scoped
  .reaction('👍')
  .chatType(['private', 'group'])
  .use(() => {});
scoped.drop(async (ctx) => ctx.chat?.type === 'channel').use(() => {});
scoped.fork(async (_ctx, next) => {
  await next();
});
scoped.lazy(async () => [new Composer<Context>(), async () => {}]);
scoped.branch(async (ctx) => Boolean(ctx.message), new Composer(), []);
scoped.route(async (ctx) => (ctx.message ? 'message' : undefined), {
  message: async (ctx, next) => {
    await ctx.reply('routed');
    await next();
  },
});
scoped
  .errorBoundary(async (error: BotError, next) => {
    void error.ctx;
    void error.error;
    await next();
  })
  .on('message')
  .use(() => {});
new Bot('types:fixture').use(scoped);

const fluent = new TelegrafComposer();
fluent.on(
  ['text', (update) => Boolean(update.callback_query)],
  async (ctx, next) => {
    const replacement = ctx;
    await next(replacement);
  }
);
fluent.command(/^go$/, async (ctx) => {
  const payload: string | undefined = ctx.payload;
  const args: string[] | undefined = ctx.args;
  await ctx.reply(`${payload}: ${args?.join(',')}`);
});
fluent.email(async (ctx, next) => {
  await next(ctx);
});
fluent.mention(['user', /person/], async (ctx) => {
  await ctx.reply('mention');
});
fluent.gameQuery(async (ctx) => {
  await ctx.answerGameQuery('https://example.test');
});
fluent.on('text', (ctx) => {
  const possiblyMissing: typeof ctx.senderChat = false;
  void possiblyMissing;
});
fluent.reaction({ type: 'emoji', emoji: '👍' }, (ctx) => {
  const match: string | import('../src/index.js').Reaction = ctx.match;
  void match;
});
fluent
  .filter(async (ctx) => Boolean(ctx.message))
  .start(async (ctx) => {
    const payload: string | undefined = ctx.startPayload;
    await ctx.reply(payload ?? 'start');
  });
fluent.use(
  TelegrafComposer.optional<TelegrafContext>(true, async (_ctx, next) => {
    await next();
  })
);
const selected = new TelegrafComposer(async (ctx) => {
  await ctx.reply('selected');
});
fluent.use(
  TelegrafComposer.branch(true, selected, TelegrafComposer.passThru())
);
fluent.use(TelegrafComposer.dispatch(async () => 'selected', { selected }));
fluent.use(
  TelegrafComposer.catch(async (_error, ctx) => {
    await ctx.reply('failed');
  }, selected)
);
const bot = new Telegraf('types:fixture');
bot.use(fluent).start(async (ctx) => {
  await ctx.reply(ctx.startPayload ?? 'hello');
});
bot.help(async (ctx) => {
  await ctx.reply('help');
});
bot.use(
  Telegraf.admin(async (ctx) => {
    await ctx.reply('admin');
  })
);
