import { TelegramClient as GramClient } from 'telegram';
import { TelegramClient as TeleClient } from 'teleproto';
import { MarkdownParser } from 'telegram/extensions/markdown.js';
import { HTMLParser } from 'teleproto/extensions/html.js';
import { MarkdownV2Parser } from 'teleproto/extensions/markdownv2.js';
import {
  Anygram,
  type AccountParseMode,
  type AccountTextEntityInput,
} from '../src/index.js';

export function ownedParsers(client: Anygram) {
  client.setParseMode(MarkdownParser);
  client.setParseMode(HTMLParser);
  client.setParseMode(MarkdownV2Parser);
  client.setParseMode(undefined);
}

export function gramParser(client: Anygram | GramClient) {
  client.setParseMode(MarkdownParser);
}

export function teleParsers(client: Anygram | TeleClient) {
  client.setParseMode(HTMLParser);
  client.setParseMode(MarkdownV2Parser);
}

export function nominalSdkDifference(gram: GramClient, tele: TeleClient) {
  // @ts-expect-error The SDK schemas declare different nominal entity classes.
  gram.setParseMode(HTMLParser);
  // @ts-expect-error The newer SDK has entity constructors absent from GramJS.
  tele.setParseMode(MarkdownParser);
}

export const parsers: AccountParseMode[] = [
  MarkdownParser,
  HTMLParser,
  MarkdownV2Parser,
];
export const entities: AccountTextEntityInput[] = MarkdownParser.parse('')[1];
export const render: AccountParseMode['unparse'] = MarkdownParser.unparse;
