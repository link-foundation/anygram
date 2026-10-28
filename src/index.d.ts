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
export declare class Anygram {
  constructor(options?: ClientOptions);
  adapters: Adapter[];
  selected?: string;
  raw: RawMethods;
  api: BotMethods;
  telegram: BotMethods;
  gramjs: {
    invoke: Anygram['invoke'];
    sendMessage(peer: unknown, options: Parameters): Promise<unknown>;
  };
  teleproto: Anygram['gramjs'];
  mtcute: { call: Anygram['invoke']; sendText: Anygram['sendMessage'] };
  mtproto: { call: Anygram['invoke'] };
  withBackend(backend: string): Anygram;
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
  getEntity(peer: unknown): Promise<unknown>;
  getInputEntity(peer: unknown): Promise<TlRequest>;
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
  resolvePeer(peer: unknown): Promise<TlRequest>;
  joinChat(peer: unknown): Promise<unknown>;
  leaveChat(peer: unknown): Promise<unknown>;
  archiveChat(peer: unknown, options?: Parameters): Promise<unknown>;
  muteChat(peer: unknown, options?: Parameters): Promise<unknown>;
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
  phoneCode?: string | (() => string | Promise<string>);
  password?: string | (() => string | Promise<string>);
  botAuthToken?: string | (() => string | Promise<string>);
  firstName?: string | (() => string | Promise<string>);
  lastName?: string;
  codeSettings?: TlRequest;
  acceptTerms?: (terms: TlRequest) => boolean | Promise<boolean>;
}
export interface FactoryOptions extends ClientOptions {
  libraries?: string[];
  native?: boolean;
  apiId?: number;
  apiHash?: string;
  token?: string;
  session?: Session | string;
  sessionStore?: import('./storage.js').SessionStore;
  onSession?: (session: string) => void | Promise<void>;
  clientOptions?: Parameters;
  transport?: import('./mtproto.js').Transport;
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
  state: Parameters;
  match?: string | RegExpExecArray;
  readonly message?: BotMessage;
  readonly editedMessage?: BotMessage;
  readonly channelPost?: BotMessage;
  readonly callbackQuery?: BotUpdate['callback_query'];
  readonly msg?: BotMessage;
  readonly chat?: BotMessage['chat'];
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
export type Middleware = (
  ctx: Context,
  next: () => Promise<void>
) => unknown | Promise<unknown>;
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
  Context?: typeof Context;
  polling?: boolean | PollingOptions;
}
export declare class Bot {
  constructor(token: string, options?: BotOptions);
  api: ContextApi;
  telegram: ContextApi;
  botInfo?: Parameters;
  offset: number;
  use(...middleware: Middleware[]): this;
  on(filters: string | string[], ...middleware: Middleware[]): this;
  command(commands: string | string[], ...middleware: Middleware[]): this;
  hears(pattern: string | RegExp, ...middleware: Middleware[]): this;
  action(pattern: string | RegExp, ...middleware: Middleware[]): this;
  catch(
    handler: (
      error: Error & { error: unknown; ctx: Context }
    ) => unknown | Promise<unknown>
  ): this;
  init(): Promise<Parameters>;
  handleUpdate(update: BotUpdate): Promise<void>;
  isRunning(): boolean;
  stop(): void;
  start(options?: PollingOptions): Promise<void>;
  launch(options?: PollingOptions): Promise<void>;
}
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
