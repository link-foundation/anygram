import type {
  GramStyleObject,
  GramStyleClient,
  Parameters,
  RequestOptions,
  FormattedText,
  TlRequest,
} from './index.js';
import type { LegacyInteger, LongValue } from './api-classes.js';

export type AccountReactionInput =
  | string
  | bigint
  | number
  | LegacyInteger
  | { className: string }
  | { _: 'reactionEmoji'; emoticon: string }
  | { _: 'reactionCustomEmoji'; document_id: LongValue }
  | { _: 'reactionEmpty' | 'reactionPaid' };
interface ReactionListData<Entity> {
  count: number;
  reactions: Entity[];
  chats: Entity[];
  users: Entity[];
}
export interface AccountReactionList
  extends GramStyleObject, ReactionListData<GramStyleObject> {
  nextOffset?: string;
}
export interface AccountReactionCanonicalList
  extends TlRequest, ReactionListData<TlRequest> {
  next_offset?: string;
}
export interface AccountReactionListOptions extends RequestOptions {
  reaction?: AccountReactionInput;
  limit?: number;
  offset?: string;
}
export interface AccountReactionMethods<Updates, List> {
  sendReaction(
    peer: unknown,
    id: number,
    reaction?: readonly AccountReactionInput[] | null,
    big?: boolean,
    addToRecent?: boolean,
    options?: RequestOptions
  ): Promise<Updates>;
  getReactionUsers(
    peer: unknown,
    id: number,
    options?: AccountReactionListOptions
  ): Promise<List>;
}

export interface AccountTextEntity extends GramStyleObject {
  offset: number;
  length: number;
}
export type AccountTextEntityInput = { offset: number; length: number } & (
  | { className: string }
  | { _: string; [key: string]: unknown }
);
export interface AccountMessageOptions extends Parameters, RequestOptions {
  message?: string | FormattedText;
  replyTo?: number;
  silent?: boolean;
  linkPreview?: boolean;
  randomId?: bigint;
  formattingEntities?: readonly AccountTextEntityInput[];
}
export interface AccountMessageEditOptions extends Parameters, RequestOptions {
  text?: string | FormattedText;
  linkPreview?: boolean;
  formattingEntities?: readonly AccountTextEntityInput[];
}
export interface AccountMessagePinOptions extends RequestOptions {
  notify?: boolean;
  pmOneSide?: boolean;
}
export interface AccountMessageDeleteOptions extends RequestOptions {
  /** GramJS defaults to false; teleproto defaults to true. */
  revoke?: boolean;
}
export type AccountShareInput =
  | { className: string }
  | { _: string; [key: string]: unknown };
export interface AccountButtonClickOptions extends RequestOptions {
  sharePhone?: boolean | string | AccountShareInput;
  shareGeo?: readonly [longitude: number, latitude: number] | AccountShareInput;
  password?: string;
}
export interface AccountPollText extends GramStyleObject {
  text: string;
  entities: AccountTextEntity[];
}
export interface AccountPollAnswer extends GramStyleObject {
  text: AccountPollText;
  option: Uint8Array;
}
export interface AccountPoll extends GramStyleObject {
  id: bigint;
  hash?: bigint;
  question: AccountPollText;
  answers: AccountPollAnswer[];
  closed?: boolean;
  multipleChoice?: boolean;
}
export interface AccountMessagePoll extends GramStyleObject {
  poll: AccountPoll;
  results: GramStyleObject;
}
export interface AccountMessageClickOptions extends AccountButtonClickOptions {
  i?: number | readonly number[];
  j?: number;
  text?: string | ((text: string | AccountPollText) => boolean);
  filter?: (value: AccountMessageButton | AccountPollAnswer) => boolean;
  data?: Uint8Array;
}
export type AccountButtonResult =
  | AccountMessage
  | GramStyleObject
  | string
  | null
  | undefined;
export interface AccountMessageButton {
  readonly button: GramStyleObject;
  readonly client: GramStyleClient;
  readonly text: string;
  readonly data?: Uint8Array;
  readonly inlineQuery?: string;
  readonly url?: string;
  click(options?: AccountButtonClickOptions): Promise<AccountButtonResult>;
}
export interface AccountMessageFile {
  readonly media: GramStyleObject;
  /** Both pinned SDKs leave compact file IDs unsupported. */
  readonly id: never;
  readonly name?: string;
  readonly mimeType?: string;
  readonly width?: number;
  readonly height?: number;
  readonly duration?: number;
  readonly title?: string;
  readonly performer?: string;
  readonly emoji?: string;
  readonly stickerSet?: GramStyleObject;
  readonly size?: number | bigint;
}
interface AccountPeerView {
  readonly client: GramStyleClient;
  readonly chatId?: bigint;
  readonly senderId?: bigint;
  readonly chat?: GramStyleObject;
  readonly sender?: GramStyleObject;
  readonly inputChat?: GramStyleObject;
  readonly inputSender?: GramStyleObject;
  readonly isPrivate?: boolean;
  readonly isChannel: boolean;
  readonly isGroup?: boolean;
  getInputChat(options?: RequestOptions): Promise<GramStyleObject | undefined>;
  getChat(options?: RequestOptions): Promise<GramStyleObject | undefined>;
  getInputSender(
    options?: RequestOptions
  ): Promise<GramStyleObject | undefined>;
  getSender(options?: RequestOptions): Promise<GramStyleObject | undefined>;
}
export interface AccountForward extends AccountPeerView {
  readonly originalFwd: GramStyleObject & {
    fromId?: GramStyleObject;
    fromName?: string;
    date: number;
  };
}
/** A detached account response with methods bound to its owning style and route. */
export interface AccountMessage extends GramStyleObject, AccountPeerView {
  _: 'message' | 'messageService';
  id: number;
  date: number;
  message?: string;
  peerId: GramStyleObject;
  fromId?: GramStyleObject;
  out?: boolean;
  post?: boolean;
  replyTo?: GramStyleObject & { replyToMsgId?: number };
  entities?: AccountTextEntity[];
  readonly isReply: boolean;
  readonly replyToMsgId?: number;
  fwdFrom?: AccountForward['originalFwd'];
  viaBotId?: bigint;
  readonly forward?: AccountForward;
  readonly viaBot?: GramStyleObject;
  readonly viaInputBot?: GramStyleObject;
  readonly actionEntities?: (GramStyleObject | undefined)[];
  readonly toId?: GramStyleObject;
  rawText: string;
  text: string;
  readonly photo?: GramStyleObject;
  readonly document?: GramStyleObject;
  readonly webPreview?: GramStyleObject;
  readonly audio?: GramStyleObject;
  readonly voice?: GramStyleObject;
  readonly video?: GramStyleObject;
  readonly videoNote?: GramStyleObject;
  readonly gif?: GramStyleObject;
  readonly sticker?: GramStyleObject;
  readonly contact?: GramStyleObject;
  readonly game?: GramStyleObject;
  readonly geo?: GramStyleObject;
  readonly invoice?: GramStyleObject;
  readonly poll?: AccountMessagePoll;
  readonly venue?: GramStyleObject;
  readonly dice?: GramStyleObject;
  readonly file?: AccountMessageFile;
  readonly buttonCount: number;
  readonly buttons?: AccountMessageButton[][];
  getButtons(
    options?: RequestOptions
  ): Promise<AccountMessageButton[][] | undefined>;
  click(options?: AccountMessageClickOptions): Promise<AccountButtonResult>;
  getReplyMessage(
    options?: RequestOptions
  ): Promise<AccountMessage | undefined>;
  respond(options?: AccountMessageOptions): Promise<AccountMessage | undefined>;
  reply(options?: AccountMessageOptions): Promise<AccountMessage | undefined>;
  edit(
    options?: AccountMessageEditOptions
  ): Promise<AccountMessage | undefined>;
  delete(options?: AccountMessageDeleteOptions): Promise<GramStyleObject[]>;
  forwardTo(
    peer: unknown,
    options?: Parameters & RequestOptions
  ): Promise<AccountMessage[]>;
  copy(
    peer: unknown,
    options?: Parameters & RequestOptions
  ): Promise<AccountMessage | undefined>;
  react(
    reaction?: AccountReactionInput | readonly AccountReactionInput[] | null,
    big?: boolean,
    addToRecent?: boolean,
    options?: RequestOptions
  ): Promise<GramStyleObject>;
  getReactions(
    limit?: number,
    reaction?: AccountReactionInput,
    offset?: string,
    options?: RequestOptions
  ): Promise<AccountReactionList>;
  downloadMedia(options?: Parameters & RequestOptions): Promise<Uint8Array>;
  pin(options?: AccountMessagePinOptions): Promise<AccountMessage | undefined>;
  unpin(options?: AccountMessagePinOptions): Promise<void>;
  markAsRead(options?: RequestOptions): Promise<boolean>;
  getEntitiesText(Class?: {
    className: string;
  }): [AccountTextEntity, string][] | undefined;
}
