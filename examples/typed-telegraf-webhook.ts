import { Telegraf } from '../src/index.js';
const bot = new Telegraf('123:example');
declare const update: Parameters<typeof bot.handleUpdate>[0];
declare const response: NonNullable<Parameters<typeof bot.handleUpdate>[1]>;
void bot.handleUpdate(update, response);
// @ts-expect-error A response must expose an end method or envelope sender.
void bot.handleUpdate(update, { writableEnded: false });
