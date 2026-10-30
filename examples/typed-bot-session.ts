import { Bot, Context, session, type SessionFlavor } from '../src/index.js';

type BotContext = Context & SessionFlavor<{ count: number }>;
const bot = new Bot<BotContext>('123:type-example');
bot.use(session({ initial: () => ({ count: 0 }) }));
bot.command('count', (ctx) => {
  ctx.session.count++;
  return ctx.reply(String(ctx.session.count));
});
