import type { MessageEntity, Parameters, TelegrafApi } from './index.js';
import type { MessageReactions } from './bot-reactions.js';

export interface ReactionSummary {
  emoji: string[];
  emojiAdded: string[];
  emojiKept: string[];
  emojiRemoved: string[];
  customEmoji: string[];
  customEmojiAdded: string[];
  customEmojiKept: string[];
  customEmojiRemoved: string[];
  paid: boolean;
  paidAdded: boolean;
}
export interface GrammyContextContent {
  entities(
    types?: string | readonly string[]
  ): (MessageEntity & { text: string })[];
  reactions(): ReactionSummary;
}
export interface TelegrafContextContent {
  entities(...types: string[]): (MessageEntity & { fragment: string })[];
  readonly text?: string;
  readonly reactions: MessageReactions;
  readonly tg: TelegrafApi;
  readonly passportData?: Parameters;
  readonly webAppData?: {
    data: { json(): unknown; text(): string };
    button_text: string;
  };
  webhookReply: boolean | undefined;
  botInfo?: Parameters;
}
