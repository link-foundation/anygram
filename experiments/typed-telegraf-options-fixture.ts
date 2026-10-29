// Generated portable request/result fixture; run generate-method-type-oracle.mjs.
import { Telegraf } from 'telegraf';
const bot = new Telegraf('123:example', {
  telegram: {
    apiRoot: 'http://localhost:8081/prefix/',
    apiMode: 'user',
    testEnv: true,
    webhookReply: false,
  },
});
const token: string = bot.telegram.token;
const mode: 'bot' | 'user' = bot.telegram.options.apiMode;
bot.telegram.options.testEnv = false;
bot.telegram.webhookReply = true;
bot.use(async (ctx) => {
  const contextToken: string = ctx.telegram.token;
  const root: string = ctx.telegram.options.apiRoot;
  ctx.telegram.options.apiMode = 'bot';
  ctx.telegram.options.webhookReply = false;
  await ctx.telegram.sendMessage(7, 'Hello');
  void contextToken;
  void root;
});
void token;
void mode;
// @ts-expect-error Unknown Telegram API mode.
new Telegraf('123:example', { telegram: { apiMode: 'other' } });
// @ts-expect-error Test environment is boolean.
new Telegraf('123:example', { telegram: { testEnv: 'test' } });
// @ts-expect-error Token is immutable.
bot.telegram.token = 'changed';
// @ts-expect-error SDK settings can mutate but cannot be replaced.
bot.telegram.options = { apiRoot: 'https://example.org' };
