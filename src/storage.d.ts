export interface TextFileOptions {
  /** UTF-8 byte limit, from 1 through 16 MiB. Defaults to 16 MiB. */
  maxBytes?: number;
  signal?: AbortSignal;
}
export declare function readTextFile(
  path: string | URL,
  options?: TextFileOptions
): Promise<string>;
export interface SessionStore {
  load(options?: Pick<TextFileOptions, 'signal'>): Promise<string>;
  save(session: string): Promise<void>;
}
export declare class FileSessionStore implements SessionStore {
  constructor(path: string, options?: Pick<TextFileOptions, 'maxBytes'>);
  path: string;
  readonly maxBytes: number;
  load(options?: Pick<TextFileOptions, 'signal'>): Promise<string>;
  save(session: string): Promise<void>;
}
