import type { BotUpdate, CommonContext } from './index.js';
import type { ContextAliasFields } from './bot-context-data.js';
import type {
  filterRoot,
  filterNodes,
  filterShortcuts,
} from './bot-filter-facts.js';
import type { FilterQuery } from './bot-filter-queries.js';
export type { FilterQuery } from './bot-filter-queries.js';

type Words<
  S extends string,
  Acc extends string = never,
> = S extends `${infer Head} ${infer Tail}` ? Words<Tail, Acc | Head> : Acc | S;
type Node<N extends number> = {
  [Edge in Words<
    (typeof filterNodes)[N]
  > as Edge extends `${infer Key}@${number}`
    ? Key
    : never]: Edge extends `${string}@${infer Child extends number}`
    ? Child
    : never;
};
type Keys<N extends number> = keyof Node<N> & string;
type Child<N extends number, K extends string> = K extends keyof Node<N>
  ? Node<N>[K] & number
  : never;
type Root = typeof filterRoot;
type ConcreteQuery = {
  [Event in Keys<Root>]:
    | Event
    | {
        [Field in Keys<Child<Root, Event>>]:
          | `${Event}:${Field}`
          | `${Event}:${Field}:${Keys<Child<Child<Root, Event>, Field>>}`;
      }[Keys<Child<Root, Event>>];
}[Keys<Root>];
type AliasTable = (typeof filterShortcuts)[number];
type Entries<T> = T extends readonly string[] ? T[number] : never;
type First = (typeof filterShortcuts)[0];
type Second = (typeof filterShortcuts)[1];

type Expanded<
  K extends string,
  Table extends AliasTable,
> = K extends keyof Table ? Entries<Table[K]> : K;
type Expand<Q extends string> =
  Q extends `${infer Event}:${infer Field}:${infer Flag}`
    ? `${Expanded<Event, First>}:${Expanded<Field, Second>}:${Flag}`
    : Q extends `${infer Event}:${infer Field}`
      ? `${Expanded<Event, First>}:${Expanded<Field, Second>}`
      : Expanded<Q, First>;
type Events<Q extends string> = Q extends `${infer Event}:${string}`
  ? Event
  : Q;
type Fields<Q extends string> = Q extends `${string}:${infer Field}:${string}`
  ? Field
  : Q extends `${string}:${infer Field}`
    ? Field
    : never;
type EventFields<Q extends string, Event extends string> = Fields<
  Extract<Q, `${Event}:${string}`>
>;
type RequiredFields<T, K extends PropertyKey> = T & {
  [P in K & keyof T]-?: NonNullable<T[P]>;
};
type MessageEvents =
  | 'message'
  | 'edited_message'
  | 'channel_post'
  | 'edited_channel_post'
  | 'business_message'
  | 'edited_business_message'
  | 'guest_message';
type EventGuarantees<Event extends string> = Event extends
  | 'channel_post'
  | 'edited_channel_post'
  ? 'sender_chat' | (Event extends 'edited_channel_post' ? 'edit_date' : never)
  : Event extends Exclude<MessageEvents, 'guest_message'>
    ? 'from' | (Event extends `edited_${string}` ? 'edit_date' : never)
    : never;
type FieldGuarantees<
  Event extends string,
  Field extends string,
> = Event extends MessageEvents
  ? Field extends 'animation'
    ? 'document'
    : Field extends 'live_photo'
      ? 'photo'
      : Field extends 'entities'
        ? 'text'
        : Field extends 'caption_entities'
          ? 'caption'
          : Field extends 'is_topic_message'
            ? 'message_thread_id'
            : never
  : never;
type EventValue<
  Event extends keyof BotUpdate,
  Field extends string,
> = RequiredFields<
  NonNullable<BotUpdate[Event]>,
  Field | EventGuarantees<Event> | FieldGuarantees<Event, Field>
>;
type Branch<
  Q extends string,
  Event extends Events<Q> & keyof BotUpdate,
  Field extends string,
> = BotUpdate & {
  [K in Event]-?: EventValue<Event, Field> &
    Partial<
      Record<
        Exclude<
          EventFields<Q, Event>,
          Field | FieldGuarantees<Event, Field> | EventGuarantees<Event>
        >,
        undefined
      >
    >;
} & Partial<Record<Exclude<Events<Q>, Event>, undefined>>;
type FieldBranches<
  Q extends string,
  Event extends Events<Q> & keyof BotUpdate,
  Field extends string = EventFields<Q, Event>,
> = [Field] extends [never]
  ? Branch<Q, Event, ''>
  : Field extends unknown
    ? Branch<Q, Event, Field>
    : never;
type QueryUpdates<
  Q extends string,
  Event extends Events<Q> & keyof BotUpdate = Events<Q> & keyof BotUpdate,
> = Event extends unknown ? FieldBranches<Q, Event> : never;
type Present<T> = [T] extends [object] ? T : undefined;
type Known<U extends BotUpdate> = { [K in keyof BotUpdate]-?: Present<U[K]> };
type Get<T, K extends PropertyKey> = T extends unknown
  ? K extends keyof T
    ? T[K]
    : undefined
  : never;
type At<T, Path extends string> = Path extends `${infer Head}.${infer Tail}`
  ? At<Get<T, Head>, Tail>
  : Get<T, Path>;
type Select<T, Paths extends readonly string[]> = Paths extends readonly [
  infer Path extends string,
  ...infer Rest extends string[],
]
  ? [At<T, Path>] extends [undefined]
    ? Select<T, Rest>
    : At<T, Path>
  : undefined;
type Messages<U extends BotUpdate> = Select<
  Known<U>,
  [
    'message',
    'edited_message',
    'channel_post',
    'edited_channel_post',
    'business_message',
    'edited_business_message',
    'guest_message',
    'callback_query.message',
  ]
>;
type Sources<U extends BotUpdate> = Known<U> & { msg: Messages<U> };
type Chats<U extends BotUpdate> = Select<
  Sources<U>,
  [
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
  ]
>;
type Senders<U extends BotUpdate> = Select<
  Sources<U>,
  [
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
  ]
>;
type Shortcuts<U extends BotUpdate> = {
  readonly [Alias in keyof ContextAliasFields]: Present<
    U[ContextAliasFields[Alias]]
  >;
} & {
  readonly msg: Messages<U>;
  readonly chat: Chats<U>;
  readonly from: Senders<U>;
  readonly senderChat: Get<Messages<U>, 'sender_chat'>;
  readonly msgId: Select<
    Sources<U>,
    [
      'msg.message_id',
      'message_reaction.message_id',
      'message_reaction_count.message_id',
    ]
  >;
  readonly chatId: Select<
    Sources<U> & { chat: Chats<U> },
    ['chat.id', 'business_connection.user_chat_id']
  >;
  readonly businessConnectionId: Select<
    Sources<U>,
    [
      'msg.business_connection_id',
      'business_connection.id',
      'deleted_business_messages.business_connection_id',
    ]
  >;
};
type Core<U extends BotUpdate> = U extends unknown
  ? { update: U } & Shortcuts<U>
  : never;
export type FilterCore<Q extends FilterQuery> = FilterQuery extends Q
  ? object
  : Core<QueryUpdates<Extract<Expand<Q>, ConcreteQuery>>>;
export type Filter<
  C extends CommonContext,
  Q extends FilterQuery,
> = FilterQuery extends Q ? C : C & FilterCore<Q>;
