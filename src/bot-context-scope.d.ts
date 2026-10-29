import type { RequestOptions } from './index.js';
export type { GrammyPositionalArguments } from './bot-positional.js';
export type { TelegrafPositionalArguments } from './telegraf-positional.js';
export type ContextRequest = RequestOptions | AbortSignal;

type StripScope<A extends unknown[], S extends unknown[]> = S extends [
  unknown,
  ...infer Remaining,
]
  ? A extends [unknown, ...infer Tail]
    ? StripScope<Tail, Remaining>
    : never
  : A;
export type ContextOperation<
  A extends unknown[],
  Scope extends unknown[] = [unknown],
> = (...args: StripScope<A, Scope>) => Promise<unknown>;
