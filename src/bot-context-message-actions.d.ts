import type { Parameters } from './index.js';
import type { BotApiResult } from './bot-api-types.js';
import type * as Scope from './bot-context-scope.js';

type Request = Scope.ContextRequest;
type Id = string | number | bigint;
type Forward<A extends unknown[], R> = (
  destination: Id,
  ...args: [...A, other?: Parameters, request?: Request]
) => Promise<R>;
interface ForwardArguments {
  forwardMessage: [];
  copyMessage: [];
  forwardMessages: [messageIds: readonly number[]];
  copyMessages: [messageIds: readonly number[]];
}
type Forwarding = {
  [K in keyof ForwardArguments]: Forward<ForwardArguments[K], BotApiResult<K>>;
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
  [K in MessageScoped]: Scope.GrammyContextOperation<K, [unknown, unknown]>;
} & {
  [K in ChatScoped]: Scope.GrammyContextOperation<K>;
} & {
  [K in Ephemeral]: Scope.GrammyContextOperation<
    K,
    [unknown, unknown, unknown]
  >;
} & {
  react(
    reaction: Reaction | readonly Reaction[],
    other?: Parameters,
    request?: Request
  ): Promise<true>;
  deleteMessageReaction(other?: Parameters, request?: Request): Promise<true>;
  deleteAllMessageReactions(
    other?: Parameters,
    request?: Request
  ): Promise<true>;
};
type TelegrafEdits =
  | 'editMessageCaption'
  | 'editMessageMedia'
  | 'editMessageReplyMarkup'
  | 'editMessageLiveLocation'
  | 'stopMessageLiveLocation';
export type TelegrafContextMessageActions = Forwarding & {
  [K in TelegrafEdits]: Scope.TelegrafContextOperation<
    K,
    [unknown, unknown, unknown]
  >;
} & {
  stopPoll: Scope.TelegrafContextOperation<'stopPoll'>;
  deleteMessages: Scope.TelegrafContextOperation<'deleteMessages'>;
  react(
    reaction?: Reaction | readonly Reaction[],
    isBig?: boolean,
    request?: Request
  ): Promise<true>;
  persistentChatAction(
    action: string,
    callback: () => unknown | Promise<unknown>,
    options?: Parameters & {
      intervalDuration?: number;
      onError?: (error: unknown) => unknown | Promise<unknown>;
    }
  ): Promise<void>;
};
