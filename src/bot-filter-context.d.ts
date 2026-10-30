import type { CommonContext } from './index.js';
import type { Filter, FilterCore } from './bot-filter-types.js';

type Match = { match: string | RegExpMatchArray };
export type HearsContext<C extends CommonContext> = Filter<
  C,
  ':text' | ':caption'
> &
  Match;
export type CommandContext<C extends CommonContext> = Filter<
  C,
  ':entities:bot_command'
> & { match: string };
export type ReactionContext<C extends CommonContext> = Filter<
  C,
  'message_reaction'
>;
export type CallbackQueryContext<C extends CommonContext> = Filter<
  C,
  'callback_query:data'
> &
  Match;
export type GameQueryContext<C extends CommonContext> = Filter<
  C,
  'callback_query:game_short_name'
> &
  Match;
export type InlineQueryContext<C extends CommonContext> = Filter<
  C,
  'inline_query'
> &
  Match;
export type ChosenInlineResultContext<C extends CommonContext> = Filter<
  C,
  'chosen_inline_result'
> &
  Match;
export type PreCheckoutQueryContext<C extends CommonContext> = Filter<
  C,
  'pre_checkout_query'
> &
  Match;
export type ShippingQueryContext<C extends CommonContext> = Filter<
  C,
  'shipping_query'
> &
  Match;
export interface CheckerScopes {
  text: FilterCore<':text' | ':caption'> & Match;
  command: FilterCore<':entities:bot_command'> & { match: string };
  reaction: FilterCore<'message_reaction'>;
  callbackQuery: FilterCore<'callback_query:data'> & Match;
  gameQuery: FilterCore<'callback_query:game_short_name'> & Match;
  inlineQuery: FilterCore<'inline_query'> & Match;
  chosenInlineResult: FilterCore<'chosen_inline_result'> & Match;
  preCheckoutQuery: FilterCore<'pre_checkout_query'> & Match;
  shippingQuery: FilterCore<'shipping_query'> & Match;
}
