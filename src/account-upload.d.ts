/** Owned SDK-style file metadata, accepted by all Anygram account backends. */
export declare class CustomFile {
  constructor(name: string, size: number, path: string, buffer?: Uint8Array);
  name: string;
  size: number;
  path: string;
  buffer?: Uint8Array;
}
