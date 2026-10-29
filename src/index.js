/**
 * Example module entry point
 * Replace this with your actual implementation
 */

/**
 * Example function that adds two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Sum of a and b
 */
export const add = (a, b) => a + b;

/**
 * Example function that multiplies two numbers
 * @param {number} a - First number
 * @param {number} b - Second number
 * @returns {number} Product of a and b
 */
export const multiply = (a, b) => a * b;

/**
 * Example async function
 * @param {number} ms - Milliseconds to wait
 * @returns {Promise<void>}
 */
export const delay = (ms) =>
  new Promise((resolve) => globalThis.setTimeout(resolve, ms));

export { Anygram } from './client.js';
export { Api } from './api.js';
export * as Rich from './rich-messages.js';
export { parseTelegramLink } from './chat-links.js';
export { createAdapter } from './adapters.js';
export { TelegramError, UnsupportedError } from './errors.js';
export { BotApi } from './bot-api.js';
export { Telegram } from './telegraf-api.js';
export { InputFile } from './input-file.js';
export { createClient } from './factory.js';
export { Session } from './session.js';
export { Bot, Telegraf, TelegramBot, webhookCallback } from './bot.js';
export { Composer, run } from './composer.js';
export { TelegrafComposer } from './telegraf-composer.js';
export { BotError } from './bot-error.js';
export {
  Scenes,
  BaseScene,
  SceneContextScene,
  Stage,
  WizardScene,
  WizardContextWizard,
} from './scenes.js';
export { Context, TelegrafContext } from './bot-context.js';
export { matchFilter } from './bot-filter-query.js';
export { ReactionList, MessageReactions } from './bot-reactions.js';
export {
  session,
  grammySession,
  telegrafSession,
  MemorySessionStore,
  MemorySessionStorage,
} from './bot-session.js';
export { UpdateManager } from './updates.js';
export {
  FormattedText,
  FormattedString,
  b,
  i,
  u,
  s,
  fmt,
  formatTemplate,
  bold,
  italic,
  underline,
  strikethrough,
  spoiler,
  code,
  pre,
  link,
  blockquote,
} from './formatting.js';
