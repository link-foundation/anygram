import { Bot, type Composer, type Context } from '../src/index.js';

export function registerQueries(bot: Bot) {
  const callbacks: Composer<Context> = bot.callbackQuery(['refresh', /^page:/]);
  callbacks.use(async (ctx) => {
    await ctx.answerCallbackQuery({ text: String(ctx.match) });
  });
  bot.gameQuery('game', async (ctx) => {
    await ctx.answerCallbackQuery({ url: 'https://example.com/game' });
  });
  bot.inlineQuery(/^search:/, async (ctx) => {
    await ctx.api.answerInlineQuery(ctx.inlineQuery?.id, []);
  });
  bot.chosenInlineResult('result', (ctx) => {
    ctx.state.chosen = ctx.chosenInlineResult?.result_id;
  });
  bot.preCheckoutQuery('invoice', async (ctx) => {
    await ctx.api.answerPreCheckoutQuery(ctx.preCheckoutQuery?.id, true);
  });
  bot.shippingQuery('invoice', async (ctx) => {
    await ctx.api.answerShippingQuery(ctx.shippingQuery?.id, false, {
      error_message: 'Delivery unavailable',
    });
  });
  bot
    .filter((ctx) => ctx.from?.id === 8)
    .use((ctx) => {
      ctx.state.authorized = true;
    });
}
