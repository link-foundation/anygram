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
  close?(): void;
}
export interface MtprotoOptions {
  apiId?: number;
  apiHash?: string;
  dc?: number;
  test?: boolean;
  transport?: Transport;
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
  connect(): Promise<void>;
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
  call<T = unknown>(
    method: string,
    params?: Parameters,
    options?: RequestOptions
  ): Promise<T>;
  invoke<T = unknown>(request: TlRequest, options?: RequestOptions): Promise<T>;
}
