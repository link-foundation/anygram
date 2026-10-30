import type { BotUpdate, BotMessage, CommonContext } from './index.js';
import type { EventValue } from './bot-filter-types.js';
import type {
  Known,
  Select,
  Get,
  ContextData,
  SourceValues,
} from './bot-update-refinement.js';

export type TelegrafUpdateType = Exclude<keyof BotUpdate, 'update_id'>;
export type TelegrafUpdateFilter =
  | TelegrafUpdateType
  | ((update: BotUpdate) => unknown);
export type TelegrafOnFilter =
  | TelegrafUpdateFilter
  | keyof BotMessage
  | 'forward_date';
type KeyedMessage<K extends keyof BotMessage> = K extends unknown
  ? { [P in K]-?: NonNullable<BotMessage[P]> }
  : never;
export interface TelegrafMessageChecks {
  has<K extends keyof BotMessage>(...keys: K[]): this is KeyedMessage<K>;
  isAccessible(): this is BotMessage;
}
export type MaybeMessage<M extends BotMessage = BotMessage> = M &
  TelegrafMessageChecks;
type EventUpdate<K extends TelegrafUpdateType> = { update_id: number } & {
  [P in K]-?: EventValue<P, ''>;
} & Partial<Record<Exclude<TelegrafUpdateType, K>, undefined>>;
type MessageUpdate<K extends string> = EventUpdate<'message'> & {
  message: EventValue<'message', K> &
    (K extends 'forward_date' ? { forward_date: number } : object);
};
export type TelegrafFilteredUpdate<F extends TelegrafOnFilter> =
  F extends TelegrafUpdateType
    ? EventUpdate<F>
    : F extends string
      ? MessageUpdate<F>
      : F extends ((update: BotUpdate) => update is infer U extends BotUpdate)
        ? U
        : BotUpdate;
type TelegrafPaths = {
  message: [
    'message',
    'edited_message',
    'callback_query.message',
    'channel_post',
    'edited_channel_post',
  ];
  chat: [
    'msg.chat',
    'message_reaction.chat',
    'message_reaction_count.chat',
    'chat_join_request.chat',
    'chat_member.chat',
    'my_chat_member.chat',
    'removed_chat_boost.chat',
  ];
  from: [
    'callback_query.from',
    'msg.from',
    'inline_query.from',
    'shipping_query.from',
    'pre_checkout_query.from',
    'chosen_inline_result.from',
    'chat_member.from',
    'my_chat_member.from',
    'chat_join_request.from',
    'message_reaction.user',
    'poll_answer.user',
    'chat_boost.boost.source.user',
  ];
};
type Sources<U extends BotUpdate> = SourceValues<U, TelegrafPaths>;
type Messages<U extends BotUpdate> = Sources<U>['msg'];
type ActiveUpdates<U extends BotUpdate> = {
  [K in TelegrafUpdateType]: Known<U>[K] extends undefined ? never : K;
}[TelegrafUpdateType];
type Core<U extends BotUpdate> = ContextData<U, TelegrafPaths> & {
  update: U;
  readonly senderChat: Messages<U> extends undefined
    ? undefined
    :
        | Get<Messages<U>, 'sender_chat'>
        | (undefined extends Get<Messages<U>, 'sender_chat'> ? false : never);
  readonly text: Messages<U> extends { text: infer Text }
    ? Text
    : Messages<U> extends { caption: infer Caption }
      ? Caption
      : Select<
          Sources<U>,
          ['msg.text', 'msg.caption', 'msg.game.text', 'poll.explanation']
        >;
  readonly updateType: ActiveUpdates<U>;
};
export type TelegrafFilterCore<F extends TelegrafOnFilter> =
  TelegrafOnFilter extends F
    ? object
    : TelegrafNarrowCore<TelegrafFilteredUpdate<F>>;
export type TelegrafNarrowCore<U extends BotUpdate> = BotUpdate extends U
  ? object
  : U extends unknown
    ? [ActiveUpdates<U>] extends [never]
      ? { update: U }
      : Core<U>
    : never;
export type NarrowedContext<C extends CommonContext, U extends BotUpdate> = C &
  TelegrafNarrowCore<U>;
export type FilteredContext<
  C extends CommonContext,
  F extends TelegrafOnFilter,
> = C & TelegrafFilterCore<F>;
export type TelegrafMatched<
  C extends CommonContext,
  F extends TelegrafOnFilter,
> = FilteredContext<C, F> & { match: RegExpExecArray };
export type TelegrafCommandContext<C extends CommonContext> = TelegrafMatched<
  C,
  'text'
> & { command: string; payload: string; args: string[] };
export type TelegrafGameContext<C extends CommonContext> = NarrowedContext<
  C,
  EventUpdate<'callback_query'> & {
    callback_query: EventValue<'callback_query', 'game_short_name'>;
  }
>;
