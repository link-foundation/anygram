import type { Context, QueryTrigger, Parameters } from './index.js';
import type {
  TelegrafUpdateFilter,
  TelegrafFilterCore,
} from './telegraf-filter-types.js';
export type { TelegrafUpdateFilter } from './telegraf-filter-types.js';
import type { Filter, FilterCore, FilterQuery } from './bot-filter-types.js';
import type { CheckerScopes } from './bot-filter-context.js';
import type {
  ChatType,
  ChatTypeContext,
  ChatTypeCore,
} from './bot-chat-types.js';
export type { FilterQuery } from './bot-filter-types.js';

export type ReactionTrigger =
  | string
  | Parameters
  | readonly (string | Parameters)[];
interface Arguments {
  filterQuery: FilterQuery;
  text: QueryTrigger;
  command: string | readonly string[];
  reaction: ReactionTrigger;
  callbackQuery: QueryTrigger;
  gameQuery: QueryTrigger;
  inlineQuery: QueryTrigger;
  chosenInlineResult: QueryTrigger;
  preCheckoutQuery: QueryTrigger;
  shippingQuery: QueryTrigger;
}
type Guard<Scope> = <C extends Context>(ctx: C) => ctx is C & Scope;
export type ContextCheckers = {
  [K in keyof CheckerScopes]: (
    argument: Arguments[K]
  ) => Guard<CheckerScopes[K]>;
} & {
  filterQuery<Q extends FilterQuery>(
    argument: Q | readonly Q[]
  ): <C extends Context>(ctx: C) => ctx is Filter<C, Q>;
  chatType<T extends ChatType>(
    argument: T | readonly T[]
  ): <C extends Context>(ctx: C) => ctx is ChatTypeContext<C, T>;
};
export interface GrammyContextCheckers {
  has<Q extends FilterQuery>(argument: Q | readonly Q[]): this is FilterCore<Q>;
  hasText(argument: Arguments['text']): this is CheckerScopes['text'];
  hasCommand(argument: Arguments['command']): this is CheckerScopes['command'];
  hasReaction(
    argument: Arguments['reaction']
  ): this is CheckerScopes['reaction'];
  hasCallbackQuery(
    argument: Arguments['callbackQuery']
  ): this is CheckerScopes['callbackQuery'];
  hasGameQuery(
    argument: Arguments['gameQuery']
  ): this is CheckerScopes['gameQuery'];
  hasInlineQuery(
    argument: Arguments['inlineQuery']
  ): this is CheckerScopes['inlineQuery'];
  hasChosenInlineResult(
    argument: Arguments['chosenInlineResult']
  ): this is CheckerScopes['chosenInlineResult'];
  hasPreCheckoutQuery(
    argument: Arguments['preCheckoutQuery']
  ): this is CheckerScopes['preCheckoutQuery'];
  hasShippingQuery(
    argument: Arguments['shippingQuery']
  ): this is CheckerScopes['shippingQuery'];
  hasChatType<T extends ChatType>(
    argument: T | readonly T[]
  ): this is ChatTypeCore<T>;
}
export interface TelegrafContextCheckers {
  has<F extends TelegrafUpdateFilter>(
    filters: F | readonly F[]
  ): this is TelegrafFilterCore<F>;
}
