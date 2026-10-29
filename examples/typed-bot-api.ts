import { Bot, Telegraf, TelegramError, type BotUpdate } from '../src/index.js';

/** The terminal's grammY calls and Telegraf calls share one native transport. */
export async function editTerminal(bot: Bot, signal: AbortSignal) {
  try {
    await bot.api.editMessageText(
      7,
      9,
      'terminal',
      { parse_mode: 'Markdown' },
      signal
    );
    await bot.api.editMessageTextInline(
      'inline:message',
      'terminal',
      {},
      signal
    );
    await bot.telegram.editMessageText(7, 9, undefined, 'terminal');
  } catch (error) {
    if (error instanceof TelegramError && error.error_code === 400) {
      return error.description ?? error.response?.description;
    }
    throw error;
  }
  return undefined;
}

export async function editFromContext(bot: Telegraf, update: BotUpdate) {
  bot.on('callback_query', async (ctx) => {
    await ctx.editMessageText('updated');
    await ctx.telegram.editMessageText(
      undefined,
      undefined,
      'inline:message',
      'updated'
    );
  });
  await bot.handleUpdate(update);
}
