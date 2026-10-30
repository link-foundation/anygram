import type { BotUpdate, CommonContext } from './index.js';
import type { UpdateContextCore } from './bot-update-refinement.js';
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
export type EventValue<
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
export type FilterCore<Q extends FilterQuery> = FilterQuery extends Q
  ? object
  : UpdateContextCore<QueryUpdate<Q>>;
export type Filter<
  C extends CommonContext,
  Q extends FilterQuery,
> = FilterQuery extends Q ? C : C & FilterCore<Q>;

export type QueryUpdate<Q extends FilterQuery> = QueryUpdates<
  Extract<Expand<Q>, ConcreteQuery>
>;
