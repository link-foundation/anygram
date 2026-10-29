import type { RequestOptions } from './index.js';
import type {
  GrammyPositionalApi,
  GrammyPositionalArguments,
  GrammyPositionalResult,
} from './bot-positional.js';
import type {
  TelegrafPositionalApi,
  TelegrafPositionalArguments,
  TelegrafPositionalResult,
} from './telegraf-positional.js';
export type { GrammyPositionalArguments } from './bot-positional.js';
export type { TelegrafPositionalArguments } from './telegraf-positional.js';
export type ContextRequest = RequestOptions | AbortSignal;

type StripScope<A extends unknown[], S extends unknown[]> = S extends [
  unknown,
  ...infer Remaining,
]
  ? A extends [unknown?, ...infer Tail]
    ? StripScope<Tail, Remaining>
    : never
  : A;
export type ContextOperation<
  A extends unknown[],
  Scope extends unknown[] = [unknown],
  Result = unknown,
> = (...args: StripScope<A, Scope>) => Promise<Result>;
export type GrammyContextOperation<
  K extends keyof GrammyPositionalApi,
  Scope extends unknown[] = [unknown],
> = ContextOperation<
  GrammyPositionalArguments<K>,
  Scope,
  GrammyPositionalResult<K>
>;
export type TelegrafContextOperation<
  K extends keyof TelegrafPositionalApi,
  Scope extends unknown[] = [unknown],
> = ContextOperation<
  TelegrafPositionalArguments<K>,
  Scope,
  TelegrafPositionalResult<K>
>;
