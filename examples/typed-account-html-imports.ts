import { HTMLParser } from 'anygram/extensions/html.js';
import { HTMLParser as Extension } from 'anygram/extensions/html';

export const parsedHtml: [string, { offset: number; length: number }[]] =
  HTMLParser.parse('<b>Ada</b>');
export const renderedHtml: string = Extension.unparse(
  ...HTMLParser.parse('Ada')
);
