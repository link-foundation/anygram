import type { Parameters, TextWithEntities } from './index.js';
import type { BotApiMethod, BotApiResult } from './bot-api-types.js';

type DeliveryMethod<K extends string> = K extends
  | 'Message'
  | 'Markdown'
  | 'MarkdownV2'
  | 'HTML'
  ? 'sendMessage'
  : K extends 'Draft'
    ? 'sendMessageDraft'
    : K extends 'Quiz'
      ? 'sendPoll'
      : `send${K}` & BotApiMethod;
type Delivery<A extends unknown[], K extends string> = (
  ...args: [...A, options?: Parameters, signal?: AbortSignal]
) => Promise<BotApiResult<DeliveryMethod<K>>>;
interface SharedArguments {
  Message: [text: string | TextWithEntities];
  Photo: [photo: unknown];
  Audio: [audio: unknown];
  Document: [document: unknown];
  Video: [video: unknown];
  Animation: [animation: unknown];
  Voice: [voice: unknown];
  Sticker: [sticker: unknown];
  VideoNote: [videoNote: unknown];
  MediaGroup: [media: readonly unknown[]];
  Location: [latitude: number, longitude: number];
  Venue: [latitude: number, longitude: number, title: string, address: string];
  Contact: [phoneNumber: string, firstName: string];
  Poll: [question: string, options: readonly unknown[]];
  ChatAction: [action: string];
  Game: [game: string];
}
interface GrammyArguments extends SharedArguments {
  RichMessage: [richMessage: unknown];
  LivePhoto: [livePhoto: unknown, photo: unknown];
  PaidMedia: [starCount: number, media: readonly unknown[]];
  Checklist: [checklist: unknown];
  Dice: [emoji?: string];
  Draft: [text: string | TextWithEntities];
  RichMessageDraft: [richMessage: unknown];
  Invoice: [
    title: string,
    description: string,
    payload: string,
    currency: string,
    prices: readonly unknown[],
  ];
}
interface TelegrafArguments extends SharedArguments {
  Dice: [];
  Invoice: [invoice: Parameters];
  Quiz: [question: string, options: readonly unknown[]];
  Markdown: [text: string | TextWithEntities];
  MarkdownV2: [text: string | TextWithEntities];
  HTML: [text: string | TextWithEntities];
}
type Reply<A> = {
  [K in keyof A as K extends 'Message'
    ? 'reply'
    : `replyWith${K & string}`]: A[K] extends unknown[]
    ? Delivery<A[K], K & string>
    : never;
};
type Declared =
  | 'reply'
  | `replyWith${'Photo' | 'Audio' | 'Document' | 'Video' | 'Animation' | 'Voice' | 'Sticker'}`;
export type GrammyContextDelivery = Omit<Reply<GrammyArguments>, Declared> & {
  sendPaidMedia: Delivery<GrammyArguments['PaidMedia'], 'PaidMedia'>;
};
export type TelegrafContextDelivery = Omit<
  Reply<TelegrafArguments>,
  Declared
> & {
  [K in keyof TelegrafArguments as K extends 'Markdown' | 'MarkdownV2' | 'HTML'
    ? never
    : `send${K & string}`]: Delivery<TelegrafArguments[K], K>;
};
