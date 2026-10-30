import { Bot, Telegraf, TelegramBot } from '../src/index.js';

export function registerErrorHandlers(
  bot: Bot,
  telegraf: Telegraf,
  events: TelegramBot
) {
  bot.catch(async ({ error, ctx }) => {
    if (error instanceof Error) {
      await ctx.reply(`Update ${ctx.update.update_id} failed`);
    }
  });
  telegraf.catch(async (error, ctx) => {
    if (error instanceof Error) {
      await ctx.reply(`Update ${ctx.update.update_id} failed`);
    }
  });
  events
    .catch(async ({ ctx }) => {
      await ctx.reply(`Update ${ctx.update.update_id} failed`);
    })
    .on('message', async () => {
      throw new Error('Application handler failed');
    });
}
