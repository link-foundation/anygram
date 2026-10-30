import { Bot, webhookCallback } from 'grammy';

declare const bot: Bot;
// The SDK runtime accepts these calls, as the default-adapter comparisons show.
// @ts-expect-error Pinned SDK declarations reject explicit undefined with options.
void webhookCallback(bot, undefined, { secretToken: 'secret' });
// @ts-expect-error Pinned SDK declarations reject explicit undefined with positional controls.
void webhookCallback(bot, undefined, 'return', 1000, 'secret');
