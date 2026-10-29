import type { Parameters } from './index.js';
import type * as Scope from './bot-context-scope.js';

type Request = Scope.ContextRequest;
type Id = string | number | bigint;
type Forward<A extends unknown[]> = (
  destination: Id,
  ...args: [...A, other?: Parameters, request?: Request]
) => Promise<unknown>;
type Forwarding = {
  forwardMessage: Forward<[]>;
  copyMessage: Forward<[]>;
  forwardMessages: Forward<[messageIds: readonly number[]]>;
  copyMessages: Forward<[messageIds: readonly number[]]>;
};
type MessageScoped =
  | 'editMessageCaption'
  | 'editMessageMedia'
  | 'editMessageReplyMarkup'
  | 'editMessageLiveLocation'
  | 'stopMessageLiveLocation'
  | 'stopPoll'
  | 'approveSuggestedPost'
  | 'declineSuggestedPost'
  | 'deleteMessageReactionUser'
  | 'deleteMessageReactionChat';
type ChatScoped =
  | 'deleteMessages'
  | 'deleteAllMessageReactionsUser'
  | 'deleteAllMessageReactionsChat'
  | 'deleteBusinessMessages';
type Ephemeral =
  | 'editEphemeralMessageText'
  | 'editEphemeralMessageMedia'
  | 'editEphemeralMessageCaption'
  | 'editEphemeralMessageReplyMarkup'
  | 'deleteEphemeralMessage'
  | 'editMessageChecklist';
type Reaction = string | Parameters;
export type GrammyContextMessageActions = Forwarding & {
  [K in MessageScoped]: Scope.ContextOperation<
    Scope.GrammyPositionalArguments<K>,
    [unknown, unknown]
  >;
} & {
  [K in ChatScoped]: Scope.ContextOperation<Scope.GrammyPositionalArguments<K>>;
} & {
  [K in Ephemeral]: Scope.ContextOperation<
    Scope.GrammyPositionalArguments<K>,
    [unknown, unknown, unknown]
  >;
} & {
  react(
    reaction: Reaction | readonly Reaction[],
    other?: Parameters,
    request?: Request
  ): Promise<unknown>;
  deleteMessageReaction(
    other?: Parameters,
    request?: Request
  ): Promise<unknown>;
  deleteAllMessageReactions(
    other?: Parameters,
    request?: Request
  ): Promise<unknown>;
};
type TelegrafEdits =
  | 'editMessageCaption'
  | 'editMessageMedia'
  | 'editMessageReplyMarkup'
  | 'editMessageLiveLocation'
  | 'stopMessageLiveLocation';
export type TelegrafContextMessageActions = Forwarding & {
  [K in TelegrafEdits]: Scope.ContextOperation<
    Scope.TelegrafPositionalArguments<K>,
    [unknown, unknown, unknown]
  >;
} & {
  stopPoll: Scope.ContextOperation<
    Scope.TelegrafPositionalArguments<'stopPoll'>
  >;
  deleteMessages: Scope.ContextOperation<
    Scope.TelegrafPositionalArguments<'deleteMessages'>
  >;
  react(
    reaction?: Reaction | readonly Reaction[],
    isBig?: boolean,
    request?: Request
  ): Promise<unknown>;
  persistentChatAction(
    action: string,
    callback: () => unknown | Promise<unknown>,
    options?: Parameters & {
      intervalDuration?: number;
      onError?: (error: unknown) => unknown | Promise<unknown>;
    }
  ): Promise<void>;
};
