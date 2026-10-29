import type { InputFile, InputFileSource, TextWithEntities } from './index.js';

/** Upload representations already recognized by the shared bounded reader. */
export type BotFileInput =
  | InputFile
  | Uint8Array
  | Blob
  | {
      source: InputFileSource;
      filename?: string;
      mimeType?: string;
    }
  | {
      data: Uint8Array | Blob;
      filename?: string;
      mimeType?: string;
    };
type Uploads<T> = T extends InputFile
  ? BotFileInput
  : T extends object
    ? { [K in keyof T]: Uploads<T[K]> }
    : T;
/** Only top-level captions use the shared formatted-text normalization. */
export type BotRequestInput<T> = {
  [K in keyof T]: K extends 'caption'
    ? Uploads<T[K]> | TextWithEntities
    : Uploads<T[K]>;
};
