import type {
  CommonContext,
  TelegrafContext,
  BotUpdate,
  Parameters as BotParameters,
  ReactionArgument,
  Composer,
} from './index.js';
import type {
  TelegrafOnFilter,
  FilteredContext,
  NarrowedContext,
  TelegrafMatched,
  TelegrafCommandContext,
  TelegrafGameContext,
} from './telegraf-filter-types.js';

export type TelegrafMiddleware<C extends CommonContext = TelegrafContext> = (
  ctx: C,
  next: (ctx?: C) => Promise<void>
) => unknown | Promise<unknown>;
export type TelegrafMiddlewareLike<C extends CommonContext = TelegrafContext> =
  | TelegrafMiddleware<C>
  | { middleware(): TelegrafMiddleware<C> };
export type TelegrafTrigger<C extends CommonContext = TelegrafContext> =
  | string
  | RegExp
  | ((value: string, ctx: C) => unknown);
type Triggers<C extends CommonContext> =
  | TelegrafTrigger<C>
  | readonly TelegrafTrigger<C>[];
type Predicate<C> = boolean | ((ctx: C) => unknown | Promise<unknown>);
type EntityPredicate<C> = (
  entity: BotParameters,
  text: string,
  ctx: C
) => unknown;
type EntityArgument<C extends CommonContext> =
  | Triggers<C>
  | TelegrafMiddlewareLike<C>
  | TelegrafMiddlewareLike<C>[];
interface RegistrationArguments<C extends CommonContext> {
  hears: [Triggers<FilteredContext<C, 'text'>>];
  command: [Triggers<FilteredContext<C, 'text'>> | TelegrafMiddlewareLike<C>];
  action: [Triggers<FilteredContext<C, 'callback_query'>>];
  inlineQuery: [Triggers<FilteredContext<C, 'inline_query'>>];
  gameQuery: [];
  reaction: [ReactionArgument | readonly ReactionArgument[]];
  entity: [string | readonly string[] | EntityPredicate<C>];
  email: [EntityArgument<C>];
  url: [EntityArgument<C>];
  textLink: [EntityArgument<C>];
  textMention: [EntityArgument<C>];
  mention: [EntityArgument<C>];
  phone: [EntityArgument<C>];
  hashtag: [EntityArgument<C>];
  cashtag: [EntityArgument<C>];
  spoiler: [EntityArgument<C>];
}
type RegistrationScopes<C extends CommonContext> = {
  hears: TelegrafMatched<C, 'text'>;
  command: TelegrafCommandContext<C>;
  action: TelegrafMatched<C, 'callback_query'>;
  inlineQuery: TelegrafMatched<C, 'inline_query'>;
  gameQuery: TelegrafGameContext<C>;
  reaction: FilteredContext<C, 'message_reaction'> & {
    match: ReactionArgument;
  };
};
type RegistrationContext<
  C extends CommonContext,
  K extends keyof RegistrationArguments<C>,
> = K extends keyof RegistrationScopes<C>
  ? RegistrationScopes<C>[K]
  : K extends 'entity'
    ? FilteredContext<C, 'message' | 'channel_post'>
    : TelegrafMatched<C, 'message' | 'channel_post'>;
interface EntityRegistration<C extends CommonContext, R> {
  (
    middleware: TelegrafMiddlewareLike<
      FilteredContext<C, 'message' | 'channel_post'>
    >,
    ...rest: TelegrafMiddlewareLike<
      FilteredContext<C, 'message' | 'channel_post'>
    >[]
  ): R;
  (
    trigger: Triggers<C>,
    ...middleware: TelegrafMiddlewareLike<
      TelegrafMatched<C, 'message' | 'channel_post'>
    >[]
  ): R;
}
type RegistrationParameters<
  C extends CommonContext,
  K extends keyof RegistrationArguments<C>,
> = [
  ...RegistrationArguments<C>[K],
  ...TelegrafMiddlewareLike<RegistrationContext<C, K>>[],
];
export interface TelegrafRegistrations<C extends CommonContext> {
  guard<U extends BotUpdate>(
    guard: (update: BotUpdate) => update is U,
    ...middleware: TelegrafMiddlewareLike<NarrowedContext<C, U>>[]
  ): this;
  guard(
    guard: (update: BotUpdate) => unknown,
    ...middleware: TelegrafMiddlewareLike<C>[]
  ): this;
  on<F extends TelegrafOnFilter>(
    filters: F | readonly F[],
    ...middleware: TelegrafMiddlewareLike<FilteredContext<C, F>>[]
  ): this;
  hears(...args: RegistrationParameters<C, 'hears'>): this;
  command(...args: RegistrationParameters<C, 'command'>): this;
  action(...args: RegistrationParameters<C, 'action'>): this;
  inlineQuery(...args: RegistrationParameters<C, 'inlineQuery'>): this;
  gameQuery(...args: RegistrationParameters<C, 'gameQuery'>): this;
  reaction(...args: RegistrationParameters<C, 'reaction'>): this;
  entity(...args: RegistrationParameters<C, 'entity'>): this;
  email: EntityRegistration<C, this>;
  url: EntityRegistration<C, this>;
  textLink: EntityRegistration<C, this>;
  textMention: EntityRegistration<C, this>;
  mention: EntityRegistration<C, this>;
  phone: EntityRegistration<C, this>;
  hashtag: EntityRegistration<C, this>;
  cashtag: EntityRegistration<C, this>;
  spoiler: EntityRegistration<C, this>;
  filter(predicate: Predicate<C>): this;
  drop(predicate: Predicate<C>): this;
  start(
    ...middleware: TelegrafMiddlewareLike<
      TelegrafCommandContext<C> & { startPayload: string }
    >[]
  ): this;
  help(
    ...middleware: TelegrafMiddlewareLike<TelegrafCommandContext<C>>[]
  ): this;
  settings(
    ...middleware: TelegrafMiddlewareLike<TelegrafCommandContext<C>>[]
  ): this;
}
type FactoryArguments<C extends CommonContext> = RegistrationArguments<C> & {
  optional: [Predicate<C>];
  acl: [number | readonly number[] | Predicate<C>];
  memberStatus: [string | readonly string[]];
  admin: [];
  creator: [];
  chatType: [string | readonly string[]];
  privateChat: [];
  groupChat: [];
  entityText: [string, EntityArgument<C>];
};
type FactoryParameters<
  C extends CommonContext,
  K extends keyof FactoryArguments<C>,
> = K extends keyof RegistrationArguments<C>
  ? RegistrationParameters<C, K>
  : [...FactoryArguments<C>[K], ...TelegrafMiddlewareLike<C>[]];
type Factories = {
  [K in keyof FactoryArguments<TelegrafContext>]: <
    C extends CommonContext = TelegrafContext,
  >(
    ...args: FactoryParameters<C, K>
  ) => TelegrafMiddleware<C>;
};
export interface TelegrafComposer<C extends CommonContext = TelegrafContext>
  extends TelegrafRegistrations<C>, TelegrafQueryExtensions<C> {
  use(...middleware: TelegrafMiddlewareLike<C>[]): this;
  middleware(): TelegrafMiddleware<C>;
}
export type TelegrafQueryExtensions<C extends CommonContext> = Pick<
  Composer<C>,
  'callbackQuery' | 'chosenInlineResult' | 'preCheckoutQuery' | 'shippingQuery'
>;
export interface TelegrafComposerConstructor extends Factories {
  guard<
    C extends CommonContext = TelegrafContext,
    U extends BotUpdate = BotUpdate,
  >(
    guard: (update: BotUpdate) => update is U,
    ...middleware: TelegrafMiddlewareLike<NarrowedContext<C, U>>[]
  ): TelegrafMiddleware<C>;
  guard<C extends CommonContext = TelegrafContext>(
    guard: (update: BotUpdate) => unknown,
    ...middleware: TelegrafMiddlewareLike<C>[]
  ): TelegrafMiddleware<C>;
  on<
    C extends CommonContext = TelegrafContext,
    F extends TelegrafOnFilter = TelegrafOnFilter,
  >(
    filters: F | readonly F[],
    ...middleware: TelegrafMiddlewareLike<FilteredContext<C, F>>[]
  ): TelegrafMiddleware<C>;
  mount: TelegrafComposerConstructor['on'];
  new <C extends CommonContext = TelegrafContext>(
    ...middleware: TelegrafMiddlewareLike<C>[]
  ): TelegrafComposer<C>;
  prototype: TelegrafComposer<any>;
  unwrap<C extends CommonContext>(
    middleware: TelegrafMiddlewareLike<C>
  ): TelegrafMiddleware<C>;
  compose<C extends CommonContext = TelegrafContext>(
    middleware: TelegrafMiddlewareLike<C>[]
  ): TelegrafMiddleware<C>;
  passThru<C extends CommonContext = TelegrafContext>(): TelegrafMiddleware<C>;
  reply(...args: Parameters<TelegrafContext['reply']>): TelegrafMiddleware;
  catch<C extends CommonContext = TelegrafContext>(
    onError: (error: unknown, ctx: C) => unknown | Promise<unknown>,
    ...middleware: TelegrafMiddlewareLike<C>[]
  ): TelegrafMiddleware<C>;
  fork<C extends CommonContext = TelegrafContext>(
    middleware: TelegrafMiddlewareLike<C>
  ): TelegrafMiddleware<C>;
  tap<C extends CommonContext = TelegrafContext>(
    middleware: TelegrafMiddlewareLike<C>
  ): TelegrafMiddleware<C>;
  lazy<C extends CommonContext = TelegrafContext>(
    factory: (
      ctx: C
    ) => TelegrafMiddlewareLike<C> | Promise<TelegrafMiddlewareLike<C>>
  ): TelegrafMiddleware<C>;
  log<C extends CommonContext = TelegrafContext>(
    logger?: (value: string) => unknown
  ): TelegrafMiddleware<C>;
  branch<C extends CommonContext = TelegrafContext>(
    predicate: Predicate<C>,
    yes: TelegrafMiddlewareLike<C>,
    no: TelegrafMiddlewareLike<C>
  ): TelegrafMiddleware<C>;
  filter<C extends CommonContext = TelegrafContext>(
    predicate: Predicate<C>
  ): TelegrafMiddleware<C>;
  drop<C extends CommonContext = TelegrafContext>(
    predicate: Predicate<C>
  ): TelegrafMiddleware<C>;
  dispatch<
    C extends CommonContext = TelegrafContext,
    K extends PropertyKey = string,
  >(
    route: (ctx: C) => K | Promise<K>,
    handlers: Record<K, TelegrafMiddlewareLike<C>>
  ): TelegrafMiddleware<C>;
  match<C extends CommonContext = TelegrafContext>(
    triggers: ((value: string, ctx: C) => unknown)[],
    ...middleware: TelegrafMiddlewareLike<C>[]
  ): TelegrafMiddleware<C>;
}
export declare const TelegrafComposer: TelegrafComposerConstructor;
