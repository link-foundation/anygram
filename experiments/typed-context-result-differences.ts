import type { TelegrafContext, Telegram as Owned } from '../src/index.js';
import type { Context } from 'telegraf';
import type * as Sdk from 'telegraf/types';

type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Assert<T extends true> = T;
// Telegraf 4.16.3 declares an array although its runtime forwards the API object.
export type BoostResults = [
  Assert<
    Equal<
      Awaited<ReturnType<TelegrafContext['getUserChatBoosts']>>,
      Owned.UserChatBoosts
    >
  >,
  Assert<
    Equal<
      Awaited<ReturnType<Context['getUserChatBoosts']>>,
      Sdk.UserChatBoosts[]
    >
  >,
];
