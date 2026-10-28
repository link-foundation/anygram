import type {
  Parameters,
  RequestOptions,
  TlRequest,
  LoginOptions,
  RunUpdatesOptions,
  UpdateState,
} from './index.js';
import type { TlCodec } from './tl.js';
export interface Transport {
  request(packet: Uint8Array, options?: RequestOptions): Promise<Uint8Array>;
  send?(packet: Uint8Array, options?: RequestOptions): Promise<void>;
  receive?(options?: RequestOptions): Promise<Uint8Array>;
  close?(): void;
}
export type FramingMode = 'abridged' | 'intermediate' | 'padded' | 'full';
export interface FramingOptions {
  mode?: FramingMode;
  maxBytes?: number;
  maxPackets?: number;
  onQuickAck?: (token: number) => void;
  random?: (length: number) => Uint8Array;
}
export declare class TransportFraming {
  constructor(options?: FramingOptions);
  readonly header: Uint8Array;
  validatePayload(packet: Uint8Array): void;
  encode(packet: Uint8Array): Uint8Array;
  push(bytes: Uint8Array): Uint8Array[];
}
export interface TcpTransportOptions extends Omit<FramingOptions, 'random'> {
  dc?: number;
  test?: boolean;
  host?: string;
  port?: number;
  timeout?: number;
  maxQueuedBytes?: number;
  connectSocket?: (options: { host: string; port: number }) => TransportSocket;
}
export interface TransportSocket {
  on(event: string, listener: (...args: any[]) => void): unknown;
  once(event: string, listener: (...args: any[]) => void): unknown;
  removeListener(event: string, listener: (...args: any[]) => void): unknown;
  write(bytes: Uint8Array, done: (error?: Error | null) => void): unknown;
  destroy(): unknown;
  setNoDelay?(noDelay?: boolean): unknown;
}
export declare class TcpTransport implements Transport {
  constructor(options?: TcpTransportOptions);
  connect(options?: RequestOptions): Promise<void>;
  send(packet: Uint8Array, options?: RequestOptions): Promise<void>;
  receive(options?: RequestOptions): Promise<Uint8Array>;
  request(packet: Uint8Array, options?: RequestOptions): Promise<Uint8Array>;
  close(): void;
}
export interface MtprotoOptions extends TcpTransportOptions {
  apiId?: number;
  apiHash?: string;
  dc?: number;
  test?: boolean;
  transport?: Transport | 'http' | 'tcp';
  transportFactory?: (dc: number) => Transport;
  authKey?: Uint8Array;
  salt?: bigint;
  timeOffset?: number;
  codec?: TlCodec;
  onUpdate?: (update: TlRequest) => void | Promise<void>;
  onSession?: (session: string) => void | Promise<void>;
  timeout?: number;
  url?: string;
  fetch?: typeof fetch;
}
export declare class HttpTransport implements Transport {
  constructor(options?: MtprotoOptions & { maxBytes?: number });
  request(packet: Uint8Array, options?: RequestOptions): Promise<Uint8Array>;
  close(): void;
}
export declare class Mtproto {
  constructor(options?: MtprotoOptions);
  codec: TlCodec;
  dc: number;
  apiId?: number;
  apiHash?: string;
  salt: bigint;
  timeOffset: number;
  transport: Transport;
  connect(options?: RequestOptions): Promise<void>;
  disconnect(): Promise<void>;
  start(options?: LoginOptions): Promise<unknown>;
  sendCode(phoneNumber: string, settings?: TlRequest): Promise<TlRequest>;
  signIn(options: {
    phoneNumber: string;
    phoneCodeHash: string;
    phoneCode: string;
    emailVerification?: TlRequest;
  }): Promise<TlRequest>;
  checkPassword(password: string): Promise<TlRequest>;
  saveSession(): string;
  pollUpdates(options?: RequestOptions & { maxWait?: number }): Promise<void>;
  runUpdates(options?: RunUpdatesOptions): Promise<UpdateState | undefined>;
  stopUpdates(): void;
  watchChannel(id: bigint | string | number): void;
  unwatchChannel(id: bigint | string | number): void;
  call<T = unknown>(
    method: string,
    params?: Parameters,
    options?: RequestOptions
  ): Promise<T>;
  invoke<T = unknown>(request: TlRequest, options?: RequestOptions): Promise<T>;
}
