import type {
  BotMessage,
  BotUpdate,
  CommonContext,
  Telegram,
} from './index.js';
import type { ContextAliasFields } from './bot-context-data.js';

export type ChatType = Telegram.Chat['type'];
type Chat<T extends ChatType> = Telegram.Chat & { type: T };
type InChat<Value, T extends ChatType> = Value extends { chat: object }
  ? Value & { chat: Chat<T> }
  : Value extends { message?: infer Message }
    ? Value & { message?: InChat<Message, T> }
    : Value;
type ChatUpdate<T extends ChatType> = {
  [K in keyof BotUpdate]: InChat<BotUpdate[K], T>;
} & Partial<
  Record<
    T extends 'channel'
      ? 'message' | 'edited_message'
      : 'channel_post' | 'edited_channel_post',
    undefined
  >
>;
type ChatAliases<T extends ChatType> = {
  readonly [K in keyof ContextAliasFields]: ChatUpdate<T>[ContextAliasFields[K]];
};
export type ChatTypeCore<T extends ChatType> = T extends unknown
  ? {
      update: ChatUpdate<T>;
      readonly chat: Chat<T>;
      readonly chatId: number;
      readonly from: T extends 'private'
        ? Telegram.User
        : Telegram.User | undefined;
      readonly msg?: BotMessage & { chat: Chat<T> };
    } & ChatAliases<T>
  : never;
export type ChatTypeContext<C extends CommonContext, T extends ChatType> = C &
  ChatTypeCore<T>;
