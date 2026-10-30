import type {
  AccountTextEntity,
  AccountTextEntityInput,
} from './account-message-types.js';

/** HTML conversion uses UTF-16 offsets and returns owned schema entities. */
export class HTMLParser {
  static parse(text: string): [string, AccountTextEntity[]];
  static unparse(
    text: string,
    entities?: readonly AccountTextEntityInput[]
  ): string;
}
