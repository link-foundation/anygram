declare const tlType: unique symbol;
export type LegacyInteger =
  | { toString(): string; toJSNumber(): number }
  | { readonly __isLong__: true; toString(): string };
export type LongValue = bigint | number | string | LegacyInteger;
export type FixedInteger = bigint | Uint8Array | LegacyInteger;

/** Schema class data; vendor resolution/custom model methods are separate. */
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
