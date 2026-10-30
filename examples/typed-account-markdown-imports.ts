import { MarkdownParser } from 'anygram/extensions/markdown.js';
import { MarkdownParser as Legacy } from 'anygram/extensions/markdown';
import { MarkdownV2Parser } from 'anygram/extensions/markdownv2.js';
import { MarkdownV2Parser as Modern } from 'anygram/extensions/markdownv2';

export const legacyText: string = Legacy.unparse(
  ...MarkdownParser.parse('**Ada**')
);
export const modernText: string = Modern.unparse(
  ...MarkdownV2Parser.parse('*Ada*')
);
