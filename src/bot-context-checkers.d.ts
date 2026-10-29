import type { Context, QueryTrigger, BotUpdate, Parameters } from './index.js';

export type FilterQuery = string | readonly string[];
export type ReactionTrigger =
  | string
  | Parameters
  | readonly (string | Parameters)[];
interface Arguments {
  filterQuery: FilterQuery;
  text: QueryTrigger;
  command: string | readonly string[];
  reaction: ReactionTrigger;
  chatType: string | readonly string[];
  callbackQuery: QueryTrigger;
  gameQuery: QueryTrigger;
  inlineQuery: QueryTrigger;
  chosenInlineResult: QueryTrigger;
  preCheckoutQuery: QueryTrigger;
  shippingQuery: QueryTrigger;
}
export type ContextCheckers = {
  [K in keyof Arguments]: (argument: Arguments[K]) => (ctx: Context) => boolean;
};
export type GrammyContextCheckers = {
  [K in keyof Arguments as K extends 'filterQuery'
    ? 'has'
    : `has${Capitalize<K>}`]: (argument: Arguments[K]) => boolean;
};
export type TelegrafUpdateFilter = string | ((update: BotUpdate) => unknown);
export interface TelegrafContextCheckers {
  has(filters: TelegrafUpdateFilter | readonly TelegrafUpdateFilter[]): boolean;
}
