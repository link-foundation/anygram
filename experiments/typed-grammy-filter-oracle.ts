import { Bot, Composer, Context } from 'grammy';
import type { FilterQuery as OriginalQuery } from 'grammy';
import type { FilterQuery as OwnedQuery } from '../src/index.js';

type Assert<T extends true> = T;
type Equal<A, B> = [A, B] extends [B, A] ? true : false;
export type CompleteQueryGrammar = Assert<Equal<OriginalQuery, OwnedQuery>>;

const bot = new Bot('123:token');
// @ts-expect-error A callback-only scope cannot promise to handle every update.
const callbacks: Composer<Context> = bot.callbackQuery('refresh');
void callbacks;
