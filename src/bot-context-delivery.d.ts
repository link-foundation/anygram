import type { BotContextApi } from './index.js';
import type { GrammyPositionalApi } from './bot-positional.js';
import type { TelegrafPositionalApi } from './telegraf-positional.js';
import type {
  ContextOperation,
  GrammyContextOperation,
  TelegrafContextOperation,
} from './bot-context-scope.js';

type Shared =
  | 'VideoNote'
  | 'MediaGroup'
  | 'Location'
  | 'Venue'
  | 'Contact'
  | 'Poll'
  | 'ChatAction'
  | 'Game'
  | 'Invoice'
  | 'Dice';
type Grammy =
  | Shared
  | 'RichMessage'
  | 'LivePhoto'
  | 'PaidMedia'
  | 'Checklist'
  | 'Draft'
  | 'RichMessageDraft';
type Media =
  | 'Photo'
  | 'Audio'
  | 'Document'
  | 'Video'
  | 'Animation'
  | 'Voice'
  | 'Sticker';
type Telegraf = Shared | Media | 'Message' | 'Quiz';
type Method<K> = K extends 'Draft'
  ? 'sendMessageDraft'
  : K extends string
    ? `send${K}`
    : never;
type Scope<K> = K extends 'Draft' | 'RichMessageDraft' | 'Checklist'
  ? [unknown, unknown]
  : [unknown];
type OptionalFirst<F> = F extends (first: infer V, ...rest: infer A) => infer R
  ? (first?: V, ...rest: A) => R
  : never;
type GrammyDelivery<K extends Grammy> = GrammyContextOperation<
  Method<K> & keyof GrammyPositionalApi,
  Scope<K>
>;
export type GrammyContextDelivery = {
  [K in Grammy as `replyWith${K}`]: K extends 'Dice'
    ? OptionalFirst<GrammyDelivery<K>>
    : GrammyDelivery<K>;
} & { sendPaidMedia: GrammyDelivery<'PaidMedia'> };
type TelegrafDelivery<K extends Telegraf> = K extends Media | 'Message'
  ? BotContextApi[Method<K>] extends (...args: infer A) => Promise<infer R>
    ? ContextOperation<A, [unknown], R>
    : never
  : TelegrafContextOperation<Method<K> & keyof TelegrafPositionalApi>;
export type TelegrafContextDelivery = {
  [K in Telegraf as `send${K}`]: TelegrafDelivery<K>;
} & {
  [K in Exclude<
    Telegraf,
    Media | 'Message'
  > as `replyWith${K}`]: TelegrafDelivery<K>;
} & {
  [K in
    | 'Markdown'
    | 'MarkdownV2'
    | 'HTML' as `replyWith${K}`]: TelegrafDelivery<'Message'>;
};
