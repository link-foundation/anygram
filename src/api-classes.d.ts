declare const tlType: unique symbol;
export type LegacyInteger =
  | { toString(): string; toJSNumber(): number }
  | { readonly __isLong__: true; toString(): string };
export type LongValue = bigint | number | string | LegacyInteger;
export type ResolvablePeer<Type extends string> =
  | string
  | number
  | bigint
  | LegacyInteger
  | TlObject<
      | Type
      | 'Peer'
      | 'User'
      | 'Chat'
      | 'InputPeer'
      | 'InputUser'
      | 'InputChannel'
    >;
type PhotoSource =
  | 'Photo'
  | 'Message'
  | 'MessageMedia'
  | 'photos.Photo'
  | 'messages.ChatFull'
  | 'ChatFull'
  | 'UserFull'
  | 'User'
  | 'Chat';
type MediaSources = {
  InputPhoto: PhotoSource;
  InputDocument: 'Document' | 'MessageMedia' | 'Message';
  InputChatPhoto: PhotoSource | 'InputPhoto' | 'InputFile';
  InputMedia:
    | 'Photo'
    | 'Document'
    | 'InputPhoto'
    | 'InputDocument'
    | 'InputFile'
    | 'Message'
    | 'MessageMedia'
    | 'photos.Photo'
    | 'ChatPhoto'
    | 'UserProfilePhoto'
    | 'Poll';
};
/** Uploaded/reusable TL values accepted by schema-aware request resolution. */
export type ResolvableMedia<Type extends keyof MediaSources> = TlObject<
  Type | MediaSources[Type]
>;
export type ResolutionOptions = { signal?: AbortSignal };
export interface PeerResolver {
  getInputEntity(peer: unknown, options?: ResolutionOptions): Promise<unknown>;
}
export type FixedInteger = bigint | Uint8Array | LegacyInteger;

/** Schema class data with shared peer resolution; vendor custom models are separate. */
export interface TlObject<
  Type extends string = string,
  Name extends string = string,
> {
  readonly [tlType]?: Type;
  className: Name;
  classType: 'request' | 'constructor';
  CONSTRUCTOR_ID: number;
  SUBCLASS_OF_ID: number;
  originalArgs: Record<string, unknown>;
  resolve(client: PeerResolver, options?: ResolutionOptions): Promise<void>;
  getBytes(): Uint8Array;
  toJSON(): Record<string, unknown>;
  [key: string]: unknown;
}

type Arguments<Fields, Defaulted extends keyof Fields> = Omit<
  Fields,
  Defaulted
> &
  Partial<Pick<Fields, Defaulted>>;

export interface TlClass<
  Name extends string,
  Type extends string,
  Fields extends Record<string, unknown>,
  Defaulted extends keyof Fields = never,
> {
  new (
    ...args: {} extends Arguments<Fields, Defaulted>
      ? [args?: Arguments<Fields, Defaulted>]
      : [args: Arguments<Fields, Defaulted>]
  ): Fields & TlObject<Type, Name>;
  className: Name;
  classType: 'request' | 'constructor';
  CONSTRUCTOR_ID: number;
  SUBCLASS_OF_ID: number;
}
