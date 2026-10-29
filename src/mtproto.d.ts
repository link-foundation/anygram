import type {
  Parameters,
  RequestOptions,
  TlRequest,
  LoginOptions,
  RunUpdatesOptions,
  UpdateState,
} from './index.js';
import type { TlCodec } from './tl.js';
export declare class SecretChatCodec extends TlCodec {
  constructor(options?: {
    layer?: number;
    maxVector?: number;
    maxDepth?: number;
    maxBytes?: number;
  });
}
export interface SecretChatDhConfig {
  p: Uint8Array;
  g: number;
  version: number;
}
/** Contains a private exponent; protect persisted pending exchanges. */
export interface SecretChatKeyExchangeState {
  version: 1;
  p: string;
  g: number;
  privateValue: string;
}
export declare class SecretChatKeyExchange {
  constructor(options: {
    p: Uint8Array;
    g: number;
    serverRandom?: Uint8Array;
    state?: SecretChatKeyExchangeState;
  });
  readonly publicValue: Uint8Array;
  complete(
    peerPublic: Uint8Array,
    expectedFingerprint?: bigint
  ): { key: Uint8Array; fingerprint: bigint };
  exportState(): SecretChatKeyExchangeState;
  destroy(): void;
}
export declare function createSecretChatKeyExchange(
  invoke: (
    method: string,
    parameters: Parameters,
    options?: RequestOptions
  ) => Promise<unknown>,
  options?: {
    config?: SecretChatDhConfig;
    signal?: AbortSignal;
    timeout?: number;
  }
): Promise<{ exchange: SecretChatKeyExchange; config: SecretChatDhConfig }>;
export interface SecretChatLayer extends TlRequest {
  _: 'decryptedMessageLayer';
  random_bytes: Uint8Array;
  layer: number;
  in_seq_no: number;
  out_seq_no: number;
  message: TlRequest;
}
/** Contains cached plaintext; protect snapshots as secret-chat message data. */
export interface SecretChatSequenceState {
  version: 1;
  originator: boolean;
  layer: number;
  incoming: number;
  outgoing: number;
  acknowledged: number;
  history: string[];
  pending: string[];
  requestedUntil: number | null;
}
export interface SecretChatResend extends TlRequest {
  _: 'decryptedMessageActionResend';
  start_seq_no: number;
  end_seq_no: number;
}
export interface SecretChatSequenceResult {
  messages: SecretChatLayer[];
  retransmit: SecretChatLayer[];
  resend: SecretChatResend | undefined;
  duplicate: boolean;
  ignored: boolean;
}
export declare class SecretChatSequence {
  constructor(options: {
    originator: boolean;
    layer?: number;
    maxPending?: number;
    maxHistory?: number;
    maxBufferedBytes?: number;
    state?: SecretChatSequenceState;
  });
  readonly state: {
    incoming: number;
    outgoing: number;
    acknowledged: number;
    pending: number;
    history: number;
    bufferedBytes: number;
    aborted: boolean;
  };
  create(message: TlRequest): SecretChatLayer;
  /** Upgrade future messages while retaining the exact cached older frames. */
  upgradeLayer(layer: number): void;
  /** Replaces cached plaintext and creates a new deletion; persist both atomically. */
  deleteUnacknowledged(
    outSequence: number,
    deletionId?: bigint
  ): { replacement: SecretChatLayer; deletion: SecretChatLayer };
  receive(frame: SecretChatLayer): SecretChatSequenceResult;
  resendRequest(): SecretChatResend | undefined;
  unacknowledged(): SecretChatLayer[];
  exportState(): SecretChatSequenceState;
  destroy(): void;
}
/** Defaults to MTProto 2.0. Legacy version 1 requires explicit selection. */
export declare class SecretChatCipher {
  constructor(
    key: Uint8Array,
    options: { originator: boolean; maxBytes?: number; version?: 1 | 2 }
  );
  encrypt(body: Uint8Array): Uint8Array;
  decrypt(packet: Uint8Array): Uint8Array;
  destroy(): void;
}
export interface Transport {
  request(packet: Uint8Array, options?: RequestOptions): Promise<Uint8Array>;
  send?(packet: Uint8Array, options?: RequestOptions): Promise<void>;
  receive?(options?: RequestOptions): Promise<Uint8Array>;
  close?(): void | Promise<void>;
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
export interface ObfuscationOptions extends FramingOptions {
  secret?: string | Uint8Array;
  dc?: number;
  test?: boolean;
  media?: boolean;
}
export declare class ObfuscatedFraming extends TransportFraming {
  constructor(options?: ObfuscationOptions);
}
export interface Socks4ConnectorOptions {
  host?: string;
  ip?: string;
  port?: number;
  socksType?: 4;
  type?: 'socks4' | 'socks4a';
  username?: string;
}
export type Socks4ProxyOptions = Socks4ConnectorOptions &
  (
    | { socksType: 4; type?: 'socks4' | 'socks4a' }
    | { type: 'socks4' | 'socks4a'; socksType?: 4 }
  );
export declare function createSocks4Connector(
  options: Socks4ConnectorOptions
): (destination: { host: string; port: number }) => TransportSocket;
export interface Socks5ProxyOptions {
  host?: string;
  ip?: string;
  port?: number;
  socksType?: 5;
  type?: 'socks5';
  username?: string;
  password?: string;
}
export declare function createSocks5Connector(
  options: Socks5ProxyOptions
): (destination: { host: string; port: number }) => TransportSocket;
export interface MtproxyEndpoint {
  host?: string;
  ip?: string;
  port?: number;
  secret: string | Uint8Array;
}
export type MtproxyOptions = MtproxyEndpoint &
  ({ MTProxy: true; type?: 'mtproxy' } | { type: 'mtproxy'; MTProxy?: true });
export interface TcpTransportOptions extends Omit<FramingOptions, 'random'> {
  dc?: number;
  test?: boolean;
  host?: string;
  port?: number;
  timeout?: number;
  maxQueuedBytes?: number;
  proxy?: Socks4ProxyOptions | Socks5ProxyOptions | MtproxyOptions;
  obfuscate?: boolean;
  media?: boolean;
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
export interface WebSocketFrame {
  opcode: 0 | 2 | 8 | 9 | 10;
  final: boolean;
  payload: Uint8Array;
}
export interface WebSocketFramingOptions {
  client?: boolean;
  maxBytes?: number;
  maxFrames?: number;
  random?: (length: number) => Uint8Array;
}
export declare class WebSocketFraming {
  constructor(options?: WebSocketFramingOptions);
  encode(
    bytes: Uint8Array,
    options?: { opcode?: WebSocketFrame['opcode']; final?: boolean }
  ): Uint8Array;
  push(bytes: Uint8Array): WebSocketFrame[];
}
export interface WebSocketTransportOptions extends Omit<
  TcpTransportOptions,
  'host' | 'port' | 'connectSocket' | 'proxy' | 'obfuscate'
> {
  url?: string;
  ca?: string | Uint8Array;
  proxy?: Socks4ProxyOptions | Socks5ProxyOptions;
  maxWebSocketBytes?: number;
}
export declare class WebSocketTransport extends TcpTransport {
  constructor(options?: WebSocketTransportOptions);
}
export interface MtprotoOptions extends TcpTransportOptions {
  apiId?: number;
  apiHash?: string;
  dc?: number;
  test?: boolean;
  transport?: Transport | 'http' | 'tcp' | 'websocket';
  transportFactory?: (dc: number) => Transport;
  authKey?: Uint8Array;
  salt?: bigint;
  timeOffset?: number;
  codec?: TlCodec;
  onUpdate?: (update: TlRequest) => void | Promise<void>;
  onSession?: (session: string) => void | Promise<void>;
  timeout?: number;
  url?: string;
  ca?: string | Uint8Array;
  maxWebSocketBytes?: number;
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
