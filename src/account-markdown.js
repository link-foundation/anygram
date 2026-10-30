import { Api } from './api.js';
import { markupText } from './account-markup.js';
import { parseMarkdown } from './account-markdown-reader.js';
import { renderMarkdown } from './account-markdown-render.js';

export const DEFAULT_DELIMITERS = Object.freeze({
  '**': Api.MessageEntityBold,
  __: Api.MessageEntityItalic,
  '~~': Api.MessageEntityStrike,
  '`': Api.MessageEntityCode,
  '```': Api.MessageEntityPre,
});

/** Legacy SDK Markdown with protected code, exact links and bounded entities. */
export class MarkdownParser {
  static parse(source) {
    return parseMarkdown(markupText(source), false);
  }
  static unparse(text, entities = []) {
    return renderMarkdown(markupText(text), entities, false);
  }
}

/** Telegram MarkdownV2 shares the scanner, bounds and context-aware writer. */
export class MarkdownV2Parser {
  static parse(source) {
    return parseMarkdown(markupText(source), true);
  }
  static unparse(text, entities = []) {
    return renderMarkdown(markupText(text), entities, true);
  }
}
