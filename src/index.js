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
export { createAdapter } from './adapters.js';
export { TelegramError, UnsupportedError } from './errors.js';
export { BotApi } from './bot-api.js';
export { createClient } from './factory.js';
export { Session } from './session.js';
export { Bot, TelegramBot, webhookCallback } from './bot.js';
export { Context } from './bot-context.js';
export { UpdateManager } from './updates.js';
