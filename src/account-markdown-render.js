import {
  MarkupOutput,
  markupEntities,
  markupNesting,
} from './account-markup.js';
import { markupDateUrl, markupIdentifier } from './account-markup-links.js';
import { escapeBounded } from './text-escape.js';

const legacy = {
  messageEntityBold: '**',
  messageEntityItalic: '__',
  messageEntityStrike: '~~',
};
const modern = {
  messageEntityBold: '*',
  messageEntityItalic: '_',
  messageEntityUnderline: '__',
  messageEntityStrike: '~',
  messageEntitySpoiler: '||',
};
const replacements = (chars) =>
  Object.fromEntries([...chars].map((char) => [char, `\\${char}`]));
const bodyEscapes = [
  replacements('\\*_~`[]'),
  replacements('\\_*[]()~`>#+-=|{}.!'),
];
const codeEscapes = replacements('\\`');
const escapeText = (text, escapes) =>
  escapeBounded(
    text,
    escapes,
    4 * 1024 * 1024,
    'Account parser text limit exceeded'
  );

function tree(text, entities) {
  const roots = [];
  const ancestors = [];
  const spans = markupEntities(text, entities);
  // Quotes own line prefixes even when a contained style covers the same span.
  spans.sort(
    (a, b) =>
      Number(b._ === 'messageEntityBlockquote') -
      Number(a._ === 'messageEntityBlockquote')
  );
  for (const entity of markupNesting(spans)) {
    const end = entity.offset + entity.length;
    while (ancestors.length && ancestors.at(-1).end <= entity.offset) {
      ancestors.pop();
    }
    const node = { entity, end, children: [] };
    const children = ancestors.length ? ancestors.at(-1).children : roots;
    children.push(node);
    ancestors.push(node);
  }
  return roots;
}

const escapeUrl = (text) => escapeText(text, replacements('\\)'));

function wrappers(entity, raw, v2) {
  const marker = (v2 ? modern : legacy)[entity._];
  if (marker) {
    return [marker, marker];
  }
  if (entity._ === 'messageEntityCode') {
    return ['`', '`', true];
  }
  if (entity._ === 'messageEntityPre') {
    const language = entity.language ?? '';
    if (!/^[\w.+-]*$/.test(language)) {
      throw new TypeError('Markdown code language must be a single identifier');
    }
    return [`\`\`\`${language}\n`, '```', true];
  }
  if (entity._ === 'messageEntityBlockquote' && v2) {
    return ['**>', entity.collapsed ? '||' : '', false, true];
  }
  const urls = {
    messageEntityTextUrl: () => entity.url,
    messageEntityUrl: () => raw,
    messageEntityEmail: () => `mailto:${raw}`,
    messageEntityMentionName: () =>
      `tg://user?id=${markupIdentifier(entity.user_id)}`,
    messageEntityCustomEmoji: () =>
      `tg://emoji?id=${markupIdentifier(entity.document_id)}`,
    messageEntityFormattedDate: () => markupDateUrl(entity),
  };
  if (Object.hasOwn(urls, entity._)) {
    const image = [
      'messageEntityCustomEmoji',
      'messageEntityFormattedDate',
    ].includes(entity._);
    return [image ? '![' : '[', `](${escapeUrl(urls[entity._]())})`];
  }
  return ['', ''];
}

class MarkdownWriter {
  constructor(text, v2) {
    this.text = text;
    this.v2 = v2;
    this.output = new MarkupOutput();
    this.last = '';
  }
  append(value) {
    if (!value) {
      return;
    }
    if (this.v2 && this.last === '_' && value.startsWith('_')) {
      this.output.append('**');
    }
    this.output.append(value);
    this.last = value.at(-1);
  }
  body(text, quoted, code = false) {
    const escaped = escapeText(
      text,
      code ? codeEscapes : bodyEscapes[Number(this.v2)]
    );
    this.append(quoted ? escapeText(escaped, { '\n': '\n>' }) : escaped);
  }
  render(start, end, nodes, quoted = false) {
    let cursor = start;
    for (const { entity, children, end: finish } of nodes) {
      this.body(this.text.slice(cursor, entity.offset), quoted);
      const [open, close, code, quote] = wrappers(
        entity,
        this.text.slice(entity.offset, finish),
        this.v2
      );
      if (
        quote &&
        (quoted ||
          (entity.offset > 0 && this.text[entity.offset - 1] !== '\n') ||
          (finish < this.text.length && this.text[finish] !== '\n'))
      ) {
        throw new TypeError(
          'Markdown blockquote requires complete, unnested lines'
        );
      }
      this.append(open);
      if (code) {
        this.body(this.text.slice(entity.offset, finish), quoted, true);
      } else {
        this.render(entity.offset, finish, children, quoted || quote);
      }
      this.append(close);
      cursor = finish;
    }
    this.body(this.text.slice(cursor, end), quoted);
  }
}

export function renderMarkdown(text, entities, v2) {
  const writer = new MarkdownWriter(text, v2);
  writer.render(0, text.length, tree(text, entities));
  return writer.output.toString();
}
