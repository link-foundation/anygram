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
export type SecretChatInvoke = (
  method: string,
  parameters: Parameters,
  options?: RequestOptions
) => Promise<unknown>;
export type SecretChatHandshakePhase =
  | 'requesting'
  | 'waiting'
  | 'accepting'
  | 'ready'
  | 'discarded';
/** Contains private exponents or shared keys; protect persisted snapshots. */
export interface SecretChatHandshakeState {
  version: 1;
  phase: SecretChatHandshakePhase;
  originator: boolean;
  selfId: string;
  remoteId: string;
  chatId: number;
  accessHash: string | null;
  user: string | null;
  publicValue: string;
  remotePublic: string | null;
  exchange: SecretChatKeyExchangeState | null;
  key: string | null;
  fingerprint: string | null;
}
export interface SecretChatHandshakeOptions extends RequestOptions {
  save: (state: SecretChatHandshakeState) => void | Promise<void>;
}
export interface SecretChatHandshakeStatus {
  phase: SecretChatHandshakePhase;
  originator: boolean;
  selfId: bigint;
  remoteId: bigint;
  chatId: number;
}
export declare class SecretChatHandshake {
  constructor(options: { state: SecretChatHandshakeState });
  readonly state: SecretChatHandshakeStatus;
  exportState(): SecretChatHandshakeState;
  /** Available only after a ready state has been saved successfully. */
  credentials(): {
    peer: TlRequest & {
      _: 'inputEncryptedChat';
      chat_id: number;
      access_hash: bigint;
    };
    originator: boolean;
    key: Uint8Array;
    fingerprint: bigint;
  };
  submit(
    invoke: SecretChatInvoke,
    options: SecretChatHandshakeOptions
  ): Promise<SecretChatHandshakeStatus>;
  apply(
    invoke: SecretChatInvoke,
    chat: TlRequest,
    options: SecretChatHandshakeOptions
  ): Promise<SecretChatHandshakeStatus>;
  destroy(): void;
}
export interface SecretChatPreparationOptions {
  selfId: bigint | string;
  config?: SecretChatDhConfig;
  signal?: AbortSignal;
  timeout?: number;
}
/** Prepares a request; call handshake.submit() with durable persistence. */
export declare function createSecretChatRequest(
  invoke: SecretChatInvoke,
  options: SecretChatPreparationOptions & {
    user: TlRequest & { user_id: bigint | string };
  }
): Promise<{ handshake: SecretChatHandshake; config: SecretChatDhConfig }>;
/** Call after the application explicitly accepts the incoming chat. */
export declare function createSecretChatAcceptance(
  invoke: SecretChatInvoke,
  options: SecretChatPreparationOptions & { chat: TlRequest }
): Promise<{ handshake: SecretChatHandshake; config: SecretChatDhConfig }>;
export interface SecretChatLayersState {
  version: 1;
  localLayer: number;
  remoteLayer: number;
  notifiedLayer: number;
  minimumV2Sequence: number | null;
  highestLegacySequence: number;
}
/** Call observe only for authenticated frames accepted by sequence checks. */
export declare class SecretChatLayers {
  constructor(options?: {
    layer?: number;
    remoteLayer?: number;
    state?: SecretChatLayersState;
  });
  readonly outgoing: { layer: number; version: 1 | 2 };
  readonly needsNotification: boolean;
  notification(): TlRequest & {
    _: 'decryptedMessageActionNotifyLayer';
    layer: number;
  };
  markNotified(layer?: number): void;
  upgradeLayer(layer: number): void;
  observe(
    frame: SecretChatLayer,
    version: 1 | 2,
    options?: { ordered?: boolean }
  ): void;
  exportState(): SecretChatLayersState;
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
export type SecretChatRekeyPhase =
  | 'idle'
  | 'requesting'
  | 'accepted'
  | 'committed';
/** Contains a pending exponent or shared key; use protected storage. */
export interface SecretChatRekeyState {
  version: 1;
  p: string;
  g: number;
  phase: SecretChatRekeyPhase;
  exchangeId: string | null;
  publicValue: string | null;
  exchange: SecretChatKeyExchangeState | null;
  key: string | null;
  fingerprint: string | null;
  createdAt: number;
  sent: number;
  received: number;
}
export interface SecretChatRekeyResult {
  actions: TlRequest[];
  install?: { key: Uint8Array; fingerprint: bigint };
  /** False for initiator commit, true for recipient noop. Commit all atomically. */
  installBeforeActions: boolean;
}
/** Ordered action state machine; key retention and durable submission are separate. */
export declare class SecretChatRekey {
  constructor(
    options: (
      | { p: Uint8Array; g: number }
      | { state: SecretChatRekeyState }
    ) & { now?: () => number }
  );
  readonly state: {
    phase: SecretChatRekeyPhase;
    exchangeId: bigint | null;
    fingerprint: bigint | null;
    createdAt: number;
    sent: number;
    received: number;
  };
  readonly candidate: { key: Uint8Array; fingerprint: bigint } | undefined;
  record(options?: { sent?: number; received?: number }): void;
  shouldRotate(now?: number): boolean;
  request(exchangeId?: bigint): TlRequest;
  pendingAction(): TlRequest | undefined;
  receive(action: TlRequest): SecretChatRekeyResult;
  /** Only after authenticating a message with the candidate key. */
  confirm(fingerprint: bigint): SecretChatRekeyResult;
  abort(): TlRequest | undefined;
  exportState(): SecretChatRekeyState;
  destroy(): void;
}
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
  retained(): SecretChatLayer[];
  pendingFrames(): SecretChatLayer[];
  pruneAcknowledged(): number;
  exportState(): SecretChatSequenceState;
  destroy(): void;
}
export interface SecretChatSessionState {
  version: 1;
  phase: 'active' | 'aborted';
  originator: boolean;
  peer: { _: 'inputEncryptedChat'; chat_id: number; access_hash: string };
  discardSubmitted: boolean;
  key: string | null;
  layers: SecretChatLayersState | null;
  sequence: SecretChatSequenceState | null;
  outbox: {
    outSequence: number;
    version: 1 | 2;
    submitted: boolean;
    data: string;
  }[];
  incomingVersions: [number, 1 | 2][];
}
export interface SecretChatSessionEffects {
  messages: SecretChatLayer[];
  aborted: boolean;
}
export interface SecretChatSessionSaveOptions {
  /** Commit messages and private state in one transaction before returning. */
  save: (
    state: SecretChatSessionState,
    effects: SecretChatSessionEffects
  ) => void | Promise<void>;
  signal?: AbortSignal;
  timeout?: number;
}
export interface SecretChatPending {
  outSequence: number;
  version: 1 | 2;
  request: TlRequest & { random_id: bigint; data: Uint8Array; peer: TlRequest };
}
/** Single-key active session. Compulsory PFS and encrypted media remain separate. */
export declare class SecretChatSession {
  constructor(
    options:
      | {
          key: Uint8Array;
          originator: boolean;
          peer: TlRequest;
          layer?: number;
          remoteLayer?: number;
          maxPending?: number;
          maxHistory?: number;
          maxBufferedBytes?: number;
        }
      | {
          state: SecretChatSessionState;
          maxPending?: number;
          maxHistory?: number;
          maxBufferedBytes?: number;
        }
  );
  readonly state: {
    phase: 'active' | 'aborted';
    pending: number;
    sequence: SecretChatSequence['state'] | null;
    layers: SecretChatLayersState | null;
    discardSubmitted: boolean;
  };
  queue(
    message: TlRequest,
    options: SecretChatSessionSaveOptions
  ): Promise<SecretChatLayer>;
  notify(
    options: SecretChatSessionSaveOptions
  ): Promise<SecretChatLayer | undefined>;
  upgradeLayer(
    layer: number,
    options: SecretChatSessionSaveOptions
  ): Promise<SecretChatLayer | undefined>;
  deleteUnacknowledged(
    outSequence: number,
    deletionId: bigint | undefined,
    options: SecretChatSessionSaveOptions
  ): Promise<{ replacement: SecretChatLayer; deletion: SecretChatLayer }>;
  receive(
    data: Uint8Array,
    options: SecretChatSessionSaveOptions
  ): Promise<SecretChatSequenceResult>;
  flush(
    client: Pick<Mtproto, 'callWithReceipt'>,
    options: SecretChatSessionSaveOptions
  ): Promise<MtprotoReceipt[]>;
  pending(): SecretChatPending[];
  exportState(): SecretChatSessionState;
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
export interface MtprotoRequestOptions extends RequestOptions {
  /** Accepted client message IDs on the selected data center (at most 1000). */
  afterMessageIds?: readonly bigint[];
}
export interface MtprotoReceipt<T = unknown> {
  value: T;
  messageId: bigint;
  dc: number;
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
    options?: MtprotoRequestOptions
  ): Promise<T>;
  callWithReceipt<T = unknown>(
    method: string,
    params?: Parameters,
    options?: MtprotoRequestOptions
  ): Promise<MtprotoReceipt<T>>;
  invoke<T = unknown>(
    request: TlRequest,
    options?: MtprotoRequestOptions
  ): Promise<T>;
}
