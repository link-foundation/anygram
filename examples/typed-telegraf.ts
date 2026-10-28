import {
  Telegraf,
  TelegrafContext,
  telegrafSession,
  type SessionFlavor,
} from '../src/index.js';

type BotContext = TelegrafContext & SessionFlavor<{ count: number }>;
const bot = new Telegraf<BotContext>('123:type-example');
bot.use(telegrafSession({ defaultSession: () => ({ count: 0 }) }));
bot.start((ctx) => {
  ctx.session.count++;
  const username: string | undefined = ctx.me;
  return ctx.reply(`${username ?? 'bot'}: ${ctx.session.count}`);
});
