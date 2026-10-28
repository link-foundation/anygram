export interface TlDefinition {
  id: string;
  method?: string;
  predicate?: string;
  type: string;
  params: { name: string; type: string }[];
}
export interface TlRegistry {
  layer: number;
  source?: string;
  constructors: TlDefinition[];
  methods: TlDefinition[];
}
export declare class TlCodec {
  constructor(options?: {
    registry?: TlRegistry;
    maxVector?: number;
    maxDepth?: number;
    maxBytes?: number;
  });
  layer: number;
  maxDepth: number;
  maxBytes: number;
  maxVector: number;
  methods: Map<string, TlDefinition>;
  constructors: Map<string, TlDefinition>;
  encode(object: unknown, type?: string): Uint8Array;
  decode<T = unknown>(bytes: Uint8Array, type?: string): T;
}
export declare class TlWriter {
  constructor(codec: TlCodec);
  write(type: string, value: unknown, depth?: number): void;
  finish(): Uint8Array;
}
export declare class TlReader {
  constructor(codec: TlCodec, bytes: Uint8Array);
  offset: number;
  read<T = unknown>(type?: string, depth?: number): T;
}
