import type { BotUpdate } from './index.js';
import type { ContextAliasFields } from './bot-context-data.js';

export type Present<T> = [T] extends [object] ? T : undefined;
export type Known<U extends BotUpdate> = {
  [K in keyof BotUpdate]-?: Present<U[K]>;
};
export type Get<T, K extends PropertyKey> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : undefined
  : never;
export type At<
  T,
  Path extends string,
> = Path extends `${infer Head}.${infer Tail}`
  ? At<Get<T, Head>, Tail>
  : Get<T, Path>;
export type Select<
  T,
  Paths extends readonly string[],
> = Paths extends readonly [
  infer Path extends string,
  ...infer Rest extends string[],
]
  ? [At<T, Path>] extends [undefined]
    ? Select<T, Rest>
    : At<T, Path>
  : undefined;
export interface SourcePaths {
  message: readonly string[];
  chat: readonly string[];
  from: readonly string[];
}
type GrammyPaths = {
  message: [
    'message',
    'edited_message',
    'channel_post',
    'edited_channel_post',
    'business_message',
    'edited_business_message',
    'guest_message',
    'callback_query.message',
  ];
  chat: [
    'msg.chat',
    'deleted_business_messages.chat',
    'stopped_message_generation.chat',
    'message_reaction.chat',
    'message_reaction_count.chat',
    'my_chat_member.chat',
    'chat_member.chat',
    'chat_join_request.chat',
    'chat_boost.chat',
    'removed_chat_boost.chat',
  ];
  from: [
    'business_connection.user',
    'message_reaction.user',
    'managed_bot.user',
    'chat_boost.boost.source.user',
    'removed_chat_boost.source.user',
    'subscription.user',
    'callback_query.from',
    'msg.from',
    'inline_query.from',
    'chosen_inline_result.from',
    'shipping_query.from',
    'pre_checkout_query.from',
    'my_chat_member.from',
    'chat_member.from',
    'chat_join_request.from',
    'purchased_paid_media.from',
  ];
};
type MessageSource<U extends BotUpdate, P extends SourcePaths> = Known<U> & {
  msg: Select<Known<U>, P['message']>;
};
export type SourceValues<
  U extends BotUpdate,
  P extends SourcePaths,
> = MessageSource<U, P> & {
  chat: Select<MessageSource<U, P>, P['chat']>;
  from: Select<MessageSource<U, P>, P['from']>;
};
export type RefinedAliases<U extends BotUpdate> = {
  readonly [Alias in keyof ContextAliasFields]: Present<
    U[ContextAliasFields[Alias]]
  >;
};
export type ContextIdentifiers<Source> = {
  readonly msgId: Select<
    Source,
    [
      'msg.message_id',
      'message_reaction.message_id',
      'message_reaction_count.message_id',
    ]
  >;
  readonly chatId: Select<
    Source,
    ['chat.id', 'business_connection.user_chat_id']
  >;
  readonly businessConnectionId: Select<
    Source,
    [
      'msg.business_connection_id',
      'business_connection.id',
      'deleted_business_messages.business_connection_id',
    ]
  >;
};
export type ContextData<
  U extends BotUpdate,
  P extends SourcePaths,
> = RefinedAliases<U> &
  ContextIdentifiers<SourceValues<U, P>> & {
    readonly [K in 'msg' | 'chat' | 'from']: SourceValues<U, P>[K];
  };
export type UpdateContextCore<U extends BotUpdate> = U extends unknown
  ? {
      update: U;
      readonly senderChat: Get<
        SourceValues<U, GrammyPaths>['msg'],
        'sender_chat'
      >;
    } & ContextData<U, GrammyPaths>
  : never;
