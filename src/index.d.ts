import type {
  TcpTransportOptions,
  EncryptedFileUpload,
  EncryptedFileDownload,
  EncryptedFileUploadOptions,
  EncryptedFileDownloadOptions,
  EncryptedFileInput,
} from './mtproto.js';

/**
 * Adds two numbers
 * @param a - First number
 * @param b - Second number
 * @returns Sum of a and b
 */
export declare const add: (a: number, b: number) => number;

/**
 * Multiplies two numbers
 * @param a - First number
 * @param b - Second number
 * @returns Product of a and b
 */
export declare const multiply: (a: number, b: number) => number;

/**
 * Delays execution for specified milliseconds
 * @param ms - Milliseconds to wait
 * @returns Promise that resolves after the delay
 */
export declare const delay: (ms: number) => Promise<void>;

export type Parameters = Record<string, unknown>;
export interface MessageEntity {
  type: string;
  offset: number;
  length: number;
  [key: string]: unknown;
}
export interface TextWithEntities {
  text: string;
  entities?: readonly MessageEntity[];
}
export declare class FormattedText implements TextWithEntities {
  constructor(
    text: string | TextWithEntities,
    entities?: readonly MessageEntity[]
  );
  readonly text: string;
  readonly entities: readonly MessageEntity[];
  readonly caption: string;
  readonly caption_entities: readonly MessageEntity[];
  toString(): string;
  plain(value: unknown): FormattedText;
  bold(value: unknown): FormattedText;
  italic(value: unknown): FormattedText;
  underline(value: unknown): FormattedText;
  strikethrough(value: unknown): FormattedText;
  spoiler(value: unknown): FormattedText;
  code(value: unknown): FormattedText;
  blockquote(value: unknown): FormattedText;
}
export declare function fmt(value: unknown, ...parts: unknown[]): FormattedText;
export declare function formatTemplate(
  template: string,
  values?: Record<string, unknown>
): FormattedText;
export type TextFormatter = (
  value: unknown,
  ...parts: unknown[]
) => FormattedText;
export declare const bold: TextFormatter;
export declare const italic: TextFormatter;
export declare const underline: TextFormatter;
export declare const strikethrough: TextFormatter;
export declare const spoiler: TextFormatter;
export declare const code: TextFormatter;
export declare const blockquote: TextFormatter;
export declare function pre(value: unknown, language?: string): FormattedText;
export declare function link(value: unknown, url: string): FormattedText;
export {
  FormattedText as FormattedString,
  bold as b,
  italic as i,
  underline as u,
  strikethrough as s,
};
export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
  dc?: number;
  migrate?: boolean;
  [key: string]: unknown;
}
export interface TlRequest extends Parameters {
  _?: string;
  className?: string;
}
export interface Adapter {
  name: string;
  kind: string;
  protocol: string;
  client: object;
  extended?: object;
  supports(operation: string): boolean;
  invoke(
    request: { method: string; params: Parameters; original?: TlRequest },
    options?: RequestOptions
  ): Promise<unknown>;
  bot(
    method: string,
    params: Parameters,
    options?: RequestOptions
  ): Promise<unknown>;
  execute(operation: string, args: unknown[]): Promise<unknown>;
}
export interface ClientOptions {
  adapters?: Adapter[];
  backend?: string;
  debug?: (event: {
    event: string;
    backend: string;
    operation: string;
  }) => void;
}
export declare function createAdapter(
  name: string,
  client: object,
  options?: {
    Api?: object;
    kind?: string;
    onSession?: (session: string) => void | Promise<void>;
  }
): Adapter;
export declare class UnsupportedError extends Error {
  operation: string;
  backend?: string;
  constructor(operation: string, backend?: string);
}
export declare class TelegramError extends Error {
  code?: number;
  type?: string;
  backend?: string;
  retryAfter?: number;
  migrateTo?: number;
  constructor(
    message: string,
    options?: {
      code?: number;
      type?: string;
      backend?: string;
      retryAfter?: number;
      migrateTo?: number;
      cause?: unknown;
    }
  );
  static from(
    error: unknown,
    backend?: string
  ): TelegramError | UnsupportedError;
}
export type BotMethods = {
  [method: string]: <T = unknown>(
    params?: Parameters,
    options?: RequestOptions
  ) => Promise<T>;
};
export type RawMethods = { [namespace: string]: BotMethods };
/** Canonical TL objects with their peer-qualified top message. */
export interface DialogEntry {
  dialog: TlRequest & { _: 'dialog' };
  entity: TlRequest & { _: string };
  inputPeer: TlRequest & { _: string };
  message?: TlRequest & { _: string };
}
export interface DialogOptions extends RequestOptions {
  limit?: number;
  /** Per-request dialog limit, from 1 to 100. Defaults to 100. */
  pageSize?: number;
  /** Request budget from 1 to 10000. Defaults to 1000. */
  maxPages?: number;
  offsetDate?: number;
  offsetId?: number;
  offsetPeer?: TlRequest;
  excludePinned?: boolean;
  /** Telegram peer folders: main (0) or archive (1); omitted includes both. */
  folderId?: 0 | 1;
}
/** Detached camelCase TL data; extended vendor model methods are not included. */
export interface GramStyleObject extends Parameters {
  _: string;
  className: string;
}
export interface GramStyleDialog {
  dialog: GramStyleObject;
  entity: GramStyleObject;
  inputEntity: GramStyleObject;
  message?: GramStyleObject;
  id: bigint;
  name: string;
  title: string;
  pinned: boolean;
  folderId?: number;
  archived: boolean;
  date?: number;
  unreadCount: number;
  unreadMentionsCount: number;
  isUser: boolean;
  isChannel: boolean;
  isGroup: boolean;
}
export interface GramStyleClient {
  invoke: Anygram['invoke'];
  sendMessage(peer: unknown, options: Parameters): Promise<unknown>;
  getMe(options?: RequestOptions): Promise<GramStyleObject>;
  getEntity(peer: unknown, options?: RequestOptions): Promise<GramStyleObject>;
  getInputEntity(
    peer: unknown,
    options?: RequestOptions
  ): Promise<GramStyleObject>;
  getMessages(peer: unknown, options?: Parameters): Promise<GramStyleObject[]>;
  iterMessages(
    peer: unknown,
    options?: Parameters
  ): AsyncIterable<GramStyleObject>;
  getDialogs(options?: DialogOptions): Promise<GramStyleDialog[]>;
  iterDialogs(options?: DialogOptions): AsyncIterable<GramStyleDialog>;
}
export type TelegramChatLink =
  | { type: 'public'; username: string; messageId?: number; threadId?: number }
  | { type: 'invite'; hash: string }
  | { type: 'phone'; phone: string }
  | {
      type: 'privateMessage';
      channelId: bigint;
      messageId: number;
      threadId?: number;
    };
/** Parse chat destinations without performing network requests or granting membership. */
export declare function parseTelegramLink(
  input: string,
  options?: { domains?: readonly string[] }
): TelegramChatLink;
export interface NotificationOptions extends RequestOptions {
  until?: number;
  showPreviews?: boolean;
  silent?: boolean;
  sound?: TlRequest;
  storiesMuted?: boolean;
  storiesHideSender?: boolean;
  storiesSound?: TlRequest;
}
export interface ConnectionScopeOptions extends RequestOptions {
  start?: Parameters;
  cleanupAttempts?: 1 | 2 | 3;
  cleanupDelay?: number;
}
export declare class Anygram {
  constructor(options?: ClientOptions);
  adapters: Adapter[];
  selected?: string;
  raw: RawMethods;
  api: BotMethods;
  telegram: BotMethods;
  gramjs: GramStyleClient;
  teleproto: Anygram['gramjs'];
  mtcute: { call: Anygram['invoke']; sendText: Anygram['sendMessage'] };
  mtproto: { call: Anygram['invoke'] };
  withBackend(backend: string): Anygram;
  withConnection<T>(
    task: (client: Anygram) => T | PromiseLike<T>,
    options?: ConnectionScopeOptions
  ): Promise<T>;
  backend<T extends object = object>(name?: string): T;
  capabilities(): { name: string; protocol: string }[];
  invoke<T = unknown>(
    method: string | TlRequest,
    params?: Parameters,
    options?: RequestOptions
  ): Promise<T>;
  call<T = unknown>(
    method: string | TlRequest,
    params?: Parameters,
    options?: RequestOptions
  ): Promise<T>;
  callBotApi<T = unknown>(
    method: string,
    params?: Parameters,
    options?: RequestOptions
  ): Promise<T>;
  execute<T = unknown>(operation: string, ...args: unknown[]): Promise<T>;
  sendMessage(
    peer: unknown,
    text: string | Parameters | TextWithEntities,
    options?: Parameters
  ): Promise<unknown>;
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  start(options?: Parameters): Promise<unknown>;
  getMe(): Promise<unknown>;
  getMessages(peer: unknown, options?: Parameters): Promise<unknown>;
  getDialogs(options?: Parameters): Promise<unknown>;
  iterDialogs(options?: DialogOptions): AsyncIterableIterator<DialogEntry>;
  getEntity(peer: unknown, options?: RequestOptions): Promise<unknown>;
  getInputEntity(peer: unknown, options?: RequestOptions): Promise<TlRequest>;
  getContacts(options?: RequestOptions): Promise<Parameters>;
  getGreetingStickers(options?: RequestOptions): Promise<Parameters[]>;
  downloadFile(location: TlRequest, options?: Parameters): Promise<Uint8Array>;
  downloadProfilePhoto(
    peer: unknown,
    options?: Parameters
  ): Promise<Uint8Array>;
  getParticipants(peer: unknown, options?: Parameters): Promise<unknown>;
  sendFile(peer: unknown, options: Parameters): Promise<unknown>;
  sendAlbum(
    peer: unknown,
    files: unknown[],
    options?: Parameters
  ): Promise<unknown>;
  uploadFile(file: unknown, options?: Parameters): Promise<TlRequest>;
  uploadEncryptedFile(
    file: EncryptedFileInput,
    options?: EncryptedFileUploadOptions
  ): Promise<EncryptedFileUpload>;
  iterDownloadEncryptedFile(
    file: EncryptedFileDownload,
    options?: EncryptedFileDownloadOptions
  ): AsyncIterable<Uint8Array>;
  downloadEncryptedFile(
    file: EncryptedFileDownload,
    options?: EncryptedFileDownloadOptions
  ): Promise<Uint8Array>;
  iterDownload(media: unknown, options?: Parameters): AsyncIterable<Uint8Array>;
  downloadMedia(media: unknown, options?: Parameters): Promise<unknown>;
  editMessage(peer: unknown, options: Parameters): Promise<unknown>;
  deleteMessages(peer: unknown, ids: number[]): Promise<unknown>;
  forwardMessages(peer: unknown, options: Parameters): Promise<unknown>;
  iterMessages(peer: unknown, options?: Parameters): AsyncIterable<Parameters>;
  searchMessages(
    peer: unknown,
    query: string,
    options?: Parameters
  ): Promise<Parameters[]>;
  resolvePeer(peer: unknown, options?: RequestOptions): Promise<TlRequest>;
  joinChat(peer: unknown, options?: RequestOptions): Promise<unknown>;
  checkChatInvite(hash: string, options?: RequestOptions): Promise<TlRequest>;
  getNotifySettings(
    peer: unknown,
    options?: RequestOptions
  ): Promise<Parameters>;
  leaveChat(peer: unknown, options?: RequestOptions): Promise<unknown>;
  archiveChat(peer: unknown, options?: Parameters): Promise<unknown>;
  muteChat(peer: unknown, options?: NotificationOptions): Promise<unknown>;
  addContact(peer: unknown, options?: Parameters): Promise<unknown>;
  saveSession(): Promise<string>;
  runUpdates(options?: RunUpdatesOptions): Promise<UpdateState | undefined>;
  stopUpdates(): Promise<void>;
  watchChannel(id: bigint | string | number): Promise<void>;
  unwatchChannel(id: bigint | string | number): Promise<void>;
}
export interface BotApiOptions {
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeout?: number;
  maxResponseBytes?: number;
}
export declare class BotApi {
  constructor(options: BotApiOptions);
  api: BotMethods;
  callApi<T = unknown>(
    method: string,
    params?: Parameters,
    options?: RequestOptions
  ): Promise<T>;
  getMe(options?: RequestOptions): Promise<unknown>;
  sendMessage(
    chat: string | number | bigint,
    text: string | TextWithEntities,
    options?: Parameters
  ): Promise<unknown>;
  editMessage(chat: unknown, options: Parameters): Promise<unknown>;
  deleteMessages(chat: unknown, ids: number[]): Promise<unknown>;
  forwardMessages(chat: unknown, options: Parameters): Promise<unknown>;
  sendFile(chat: unknown, options: Parameters): Promise<unknown>;
  downloadMedia(
    fileId: string,
    options?: RequestOptions & { maxBytes?: number }
  ): Promise<Uint8Array>;
}

export interface SessionOptions {
  dc?: number;
  authKey?: Uint8Array;
  salt?: bigint;
  timeOffset?: number;
  test?: boolean;
  serverAddress?: string;
  port?: number;
}
/** save() contains account credentials; never log or publish its result. */
export declare class Session {
  constructor(value?: SessionOptions | string | Session);
  options(): SessionOptions;
  save(format?: 'anygram' | 'gramjs'): string;
  toJSON(): string;
  static fromClient(client: import('./mtproto.js').Mtproto): Session;
}
export type EmailVerification =
  | { _: 'emailVerificationCode'; code: string }
  | { _: 'emailVerificationGoogle' | 'emailVerificationApple'; token: string };
export interface LoginChallenge extends TlRequest {
  type?: TlRequest;
  phone_code_hash?: string;
  email_pattern?: string;
  length?: number;
}
export type LoginCodeInput =
  | string
  | ((challenge: LoginChallenge) => string | Promise<string>);
export type LoginCodeDeliveryAction =
  | { action: 'resend'; reason?: string }
  | { action: 'cancel' };
export interface LoginOptions {
  signal?: AbortSignal;
  timeout?: number;
  qrCode?: (value: {
    token: Uint8Array;
    expires: number;
    url: string;
  }) => void | Promise<void>;
  exceptIds?: bigint[];
  maxQrAttempts?: number;
  qrTimeout?: number;
  phoneNumber?: string | (() => string | Promise<string>);
  phoneCode?: LoginCodeInput;
  /** Return nothing to prompt normally, or explicitly resend/cancel this code. */
  onCode?: (
    challenge: LoginChallenge
  ) => LoginCodeDeliveryAction | void | Promise<LoginCodeDeliveryAction | void>;
  email?: LoginCodeInput;
  emailCode?: LoginCodeInput;
  emailVerification?:
    | EmailVerification
    | ((
        challenge: LoginChallenge
      ) => EmailVerification | Promise<EmailVerification>);
  maxLoginSteps?: number;
  password?: string | (() => string | Promise<string>);
  botAuthToken?: string | (() => string | Promise<string>);
  firstName?: string | (() => string | Promise<string>);
  lastName?: string;
  codeSettings?: TlRequest;
  acceptTerms?: (terms: TlRequest) => boolean | Promise<boolean>;
}
export interface FactoryOptions extends ClientOptions, TcpTransportOptions {
  libraries?: string[];
  native?: boolean;
  apiId?: number;
  apiHash?: string;
  token?: string;
  session?: Session | string;
  sessionStore?: import('./storage.js').SessionStore;
  onSession?: (session: string) => void | Promise<void>;
  clientOptions?: Parameters;
  transport?: import('./mtproto.js').Transport | 'http' | 'tcp' | 'websocket';
  url?: string;
  ca?: string | Uint8Array;
  maxWebSocketBytes?: number;
  transportFactory?: (dc: number) => import('./mtproto.js').Transport;
  fetch?: typeof fetch;
  timeout?: number;
}
export declare function createClient(
  options?: FactoryOptions
): Promise<Anygram>;

export interface ChannelState {
  pts?: number;
  access_hash: bigint | string;
}
export interface UpdateState {
  pts: number;
  qts: number;
  seq: number;
  date: number;
  channels: Record<string, ChannelState>;
}
export interface UpdateManagerOptions {
  invoke: (method: string, params?: Parameters) => Promise<unknown>;
  state?: Partial<UpdateState>;
  onUpdate?: (update: TlRequest) => void | Promise<void>;
  onState?: (state: UpdateState) => void | Promise<void>;
  onReset?: (event: Parameters) => void | Promise<void>;
  resolveChannel?: (id: bigint) => TlRequest | Promise<TlRequest>;
  maxPages?: number;
  clock?: () => number;
}
export interface RunUpdatesOptions
  extends Omit<UpdateManagerOptions, 'invoke'>, RequestOptions {
  stateStore?: import('./storage.js').SessionStore;
  maxPolls?: number;
  maxWait?: number;
  watchedChannels?: (bigint | string | number)[];
}
export declare class UpdateManager {
  constructor(options: UpdateManagerOptions);
  state: UpdateState;
  initialize(): Promise<void>;
  feed(update: TlRequest): Promise<void>;
  watchChannel(id: bigint | string | number): void;
  unwatchChannel(id: bigint | string | number): void;
  tick(): Promise<void>;
  recover(): Promise<void>;
  recoverChannel(id: bigint): Promise<number | undefined>;
}

export interface BotMessage extends Parameters {
  message_id: number;
  chat: { id: number; [key: string]: unknown };
  from?: { id: number; [key: string]: unknown };
  text?: string;
}
export interface BotUpdate extends Parameters {
  update_id: number;
  message?: BotMessage;
  edited_message?: BotMessage;
  channel_post?: BotMessage;
  callback_query?: {
    id: string;
    data?: string;
    message?: BotMessage;
    inline_message_id?: string;
    from?: Parameters;
  };
}
export interface ContextApi {
  raw: BotMethods;
  callApi: BotApi['callApi'];
  getMe(): Promise<Parameters>;
  sendMessage(
    chat: unknown,
    text: string | TextWithEntities,
    options?: Parameters
  ): Promise<BotMessage>;
  editMessageText(
    chat: unknown,
    id: number | undefined,
    inlineId: string | undefined,
    text: string | TextWithEntities,
    options?: Parameters
  ): Promise<unknown>;
  deleteMessage(chat: unknown, id: number): Promise<unknown>;
  answerCallbackQuery(id: string, options?: Parameters): Promise<unknown>;
  [key: string]: unknown;
}
export declare class Context {
  constructor(update: BotUpdate, api: ContextApi, me?: Parameters);
  update: BotUpdate;
  api: ContextApi;
  telegram: ContextApi;
  me?: Parameters;
  readonly botInfo?: Parameters;
  state: Parameters;
  match?: string | RegExpExecArray;
  readonly message?: BotMessage;
  readonly editedMessage?: BotMessage;
  readonly channelPost?: BotMessage;
  readonly callbackQuery?: BotUpdate['callback_query'];
  readonly msg?: BotMessage;
  readonly chat?: BotMessage['chat'];
  readonly chatId?: string | number | bigint;
  readonly from?: Parameters;
  reply(
    text: string | TextWithEntities,
    options?: Parameters
  ): Promise<BotMessage>;
  editMessageText(
    text: string | TextWithEntities,
    options?: Parameters
  ): Promise<unknown>;
  answerCallbackQuery(options?: string | Parameters): Promise<unknown>;
  deleteMessage(id?: number): Promise<unknown>;
  replyWithPhoto(file: unknown, options?: Parameters): Promise<unknown>;
  replyWithAnimation(file: unknown, options?: Parameters): Promise<unknown>;
  replyWithDocument(file: unknown, options?: Parameters): Promise<unknown>;
  replyWithVideo(file: unknown, options?: Parameters): Promise<unknown>;
  replyWithAudio(file: unknown, options?: Parameters): Promise<unknown>;
  replyWithVoice(file: unknown, options?: Parameters): Promise<unknown>;
  replyWithSticker(file: unknown, options?: Parameters): Promise<unknown>;
}
export interface TelegrafContext extends Omit<Context, 'me'> {
  readonly me?: string;
}
export declare const TelegrafContext: {
  new (update: BotUpdate, api: ContextApi, me?: Parameters): TelegrafContext;
};
export type Middleware<C extends Omit<Context, 'me'> = Context> = (
  ctx: C,
  next: () => Promise<void>
) => unknown | Promise<unknown>;
export interface SessionFlavor<S> {
  session: S;
}
export interface BotSessionStorage<S> {
  read(key: string): S | undefined | Promise<S | undefined>;
  write(key: string, value: S): void | Promise<void>;
  delete(key: string): void | Promise<void>;
}
export interface BotSessionStore<S> {
  get(key: string): S | undefined | Promise<S | undefined>;
  set(key: string, value: S): void | Promise<void>;
  delete(key: string): void | Promise<void>;
}
export interface BotSessionOptions<S, C extends Omit<Context, 'me'> = Context> {
  initial?: (ctx: C) => S | Promise<S>;
  defaultSession?: (ctx: C) => S | Promise<S>;
  storage?: BotSessionStorage<S>;
  store?: BotSessionStore<S>;
  getSessionKey?: (ctx: C) => string | undefined | Promise<string | undefined>;
  prefix?: string;
  property?: string;
  maxPending?: number;
}
export declare class MemorySessionStore<S = Parameters>
  implements BotSessionStorage<S>, BotSessionStore<S>
{
  constructor(
    options?: number | { ttl?: number; maxEntries?: number; now?: () => number }
  );
  readonly size: number;
  get(key: string): S | undefined;
  set(key: string, value: S): void;
  read(key: string): S | undefined;
  write(key: string, value: S): void;
  delete(key: string): void;
}
export { MemorySessionStore as MemorySessionStorage };
export declare function session<S, C extends Omit<Context, 'me'> = Context>(
  options?: BotSessionOptions<S, C>
): Middleware<C & SessionFlavor<S>>;
export declare const grammySession: typeof session;
export declare const telegrafSession: typeof session;
export interface PollingOptions {
  maxPolls?: number;
  timeout?: number;
  allowed_updates?: string[];
  onStart?: (me?: Parameters) => unknown | Promise<unknown>;
}
export interface BotOptions extends Partial<BotApiOptions> {
  api?: BotApi | Anygram;
  botInfo?: Parameters;
  offset?: number;
  Context?: new (
    update: BotUpdate,
    api: ContextApi,
    me?: Parameters
  ) => Omit<Context, 'me'>;
  polling?: boolean | PollingOptions;
}
export type MiddlewareLike<C extends Omit<Context, 'me'> = Context> =
  | Middleware<C>
  | { middleware(): Middleware<C> };
export declare class Composer<C extends Omit<Context, 'me'> = Context> {
  constructor(...middleware: MiddlewareLike<C>[]);
  use(...middleware: MiddlewareLike<C>[]): this;
  on(filters: string | string[], ...middleware: Middleware<C>[]): this;
  command(commands: string | string[], ...middleware: Middleware<C>[]): this;
  hears(pattern: string | RegExp, ...middleware: Middleware<C>[]): this;
  action(pattern: string | RegExp, ...middleware: Middleware<C>[]): this;
  middleware(): Middleware<C>;
}
export declare class Bot<
  C extends Omit<Context, 'me'> = Context,
> extends Composer<C> {
  constructor(token: string, options?: BotOptions);
  api: ContextApi;
  telegram: ContextApi;
  botInfo?: Parameters;
  offset: number;
  catch(
    handler: (
      error: Error & { error: unknown; ctx: C }
    ) => unknown | Promise<unknown>
  ): this;
  init(): Promise<Parameters>;
  handleUpdate(update: BotUpdate): Promise<void>;
  isRunning(): boolean;
  stop(): void;
  start(options?: PollingOptions): Promise<void>;
  launch(options?: PollingOptions): Promise<void>;
}
export interface Telegraf<
  C extends Omit<Context, 'me'> = TelegrafContext,
> extends Omit<Bot<C>, 'start'> {
  start(...middleware: Middleware<C>[]): this;
}
export declare const Telegraf: {
  new <C extends Omit<Context, 'me'> = TelegrafContext>(
    token: string,
    options?: BotOptions
  ): Telegraf<C>;
};
export declare class TelegramBot {
  constructor(token: string, options?: BotOptions);
  api: ContextApi;
  telegram: ContextApi;
  handleUpdate(update: BotUpdate): Promise<void>;
  stop(): void;
  isRunning(): boolean;
  on(event: string, callback: (value: any) => unknown): this;
  once(event: string, callback: (value: any) => unknown): this;
  onText(
    pattern: RegExp,
    callback: (message: BotMessage, match: RegExpExecArray) => unknown
  ): this;
  removeListener(event: string, callback: Function): this;
  removeAllListeners(event?: string): this;
  startPolling(options?: PollingOptions): Promise<void>;
  stopPolling(): Promise<void>;
  processUpdate(update: BotUpdate): Promise<void>;
  sendMessage(
    chat: unknown,
    text: string | TextWithEntities,
    options?: Parameters
  ): Promise<BotMessage>;
  editMessageText(
    text: string | TextWithEntities,
    options: Parameters
  ): Promise<unknown>;
  getChat(chat: unknown): Promise<unknown>;
  deleteMessage(chat: unknown, message: number): Promise<unknown>;
  answerCallbackQuery(id: string, options?: Parameters): Promise<unknown>;
}
export declare function webhookCallback(
  bot: Pick<Bot, 'handleUpdate'>,
  options?: { secretToken?: string; maxBytes?: number }
): (request: Request) => Promise<Response>;
export * from './scenes.js';
