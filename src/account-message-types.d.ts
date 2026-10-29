import type {
  GramStyleObject,
  GramStyleClient,
  Parameters,
  RequestOptions,
  FormattedText,
} from './index.js';

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
/** A detached account response with methods bound to its owning style and route. */
export interface AccountMessage extends GramStyleObject {
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
  readonly isReply: boolean;
  readonly replyToMsgId?: number;
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
  readonly poll?: GramStyleObject;
  readonly venue?: GramStyleObject;
  readonly dice?: GramStyleObject;
  readonly file?: AccountMessageFile;
  getInputChat(options?: RequestOptions): Promise<GramStyleObject | undefined>;
  getChat(options?: RequestOptions): Promise<GramStyleObject | undefined>;
  getInputSender(
    options?: RequestOptions
  ): Promise<GramStyleObject | undefined>;
  getSender(options?: RequestOptions): Promise<GramStyleObject | undefined>;
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
  downloadMedia(options?: Parameters & RequestOptions): Promise<Uint8Array>;
  pin(options?: AccountMessagePinOptions): Promise<AccountMessage | undefined>;
  unpin(options?: AccountMessagePinOptions): Promise<void>;
  markAsRead(options?: RequestOptions): Promise<boolean>;
  getEntitiesText(Class?: {
    className: string;
  }): [AccountTextEntity, string][] | undefined;
}
