/**
 * Example module type definitions
 * Replace this with your actual type definitions
 */

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
export interface RequestOptions {
  signal?: AbortSignal;
  timeout?: number;
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
  options?: { Api?: object; kind?: string }
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
    text: string | Parameters,
    options?: Parameters
  ): Promise<unknown>;
  connect(): Promise<unknown>;
  disconnect(): Promise<unknown>;
  start(options?: Parameters): Promise<unknown>;
  getMe(): Promise<unknown>;
  getMessages(peer: unknown, options?: Parameters): Promise<unknown>;
  getDialogs(options?: Parameters): Promise<unknown>;
  getEntity(peer: unknown): Promise<unknown>;
  getParticipants(peer: unknown, options?: Parameters): Promise<unknown>;
  sendFile(peer: unknown, options: Parameters): Promise<unknown>;
  downloadMedia(media: unknown, options?: Parameters): Promise<unknown>;
  editMessage(peer: unknown, options: Parameters): Promise<unknown>;
  deleteMessages(peer: unknown, ids: number[]): Promise<unknown>;
  forwardMessages(peer: unknown, options: Parameters): Promise<unknown>;
}
export interface BotApiOptions {
  token: string;
  baseUrl?: string;
  fetch?: typeof fetch;
  timeout?: number;
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
    text: string,
    options?: Parameters
  ): Promise<unknown>;
  editMessage(chat: unknown, options: Parameters): Promise<unknown>;
  deleteMessages(chat: unknown, ids: number[]): Promise<unknown>;
  forwardMessages(chat: unknown, options: Parameters): Promise<unknown>;
  sendFile(chat: unknown, options: Parameters): Promise<unknown>;
  downloadMedia(fileId: string, options?: RequestOptions): Promise<Uint8Array>;
}
