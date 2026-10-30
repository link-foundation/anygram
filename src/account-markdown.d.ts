import { HTMLParser } from './account-html.js';
import { Api } from './api.js';

/** The parser classes share the checked text/entity boundary. */
export class MarkdownParser {
  static parse: typeof HTMLParser.parse;
  static unparse: typeof HTMLParser.unparse;
}
export class MarkdownV2Parser {
  static parse: typeof HTMLParser.parse;
  static unparse: typeof HTMLParser.unparse;
}
export const DEFAULT_DELIMITERS: Readonly<{
  '**': typeof Api.MessageEntityBold;
  __: typeof Api.MessageEntityItalic;
  '~~': typeof Api.MessageEntityStrike;
  '`': typeof Api.MessageEntityCode;
  '```': typeof Api.MessageEntityPre;
}>;
