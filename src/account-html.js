import references from './schema/html-entities.json' with { type: 'json' };
import { escapeBounded } from './text-escape.js';
import {
  markupIdentifier as identifier,
  markupDate,
} from './account-markup-links.js';
import {
  MarkupOutput,
  markupText,
  markupEntities,
  markupNesting,
  markupResult,
} from './account-markup.js';

const escapes = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
};
const escapeHtml = (text) =>
  escapeBounded(
    markupText(text),
    escapes,
    4 * 1024 * 1024,
    'Account parser text limit exceeded'
  );
const replacements = new Map([
  [128, 8364],
  [130, 8218],
  [131, 402],
  [132, 8222],
  [133, 8230],
  [134, 8224],
  [135, 8225],
  [136, 710],
  [137, 8240],
  [138, 352],
  [139, 8249],
  [140, 338],
  [142, 381],
  [145, 8216],
  [146, 8217],
  [147, 8220],
  [148, 8221],
  [149, 8226],
  [150, 8211],
  [151, 8212],
  [152, 732],
  [153, 8482],
  [154, 353],
  [155, 8250],
  [156, 339],
  [158, 382],
  [159, 376],
]);

function decodeReference(whole, reference, attribute, following) {
  if (reference[0] === '#') {
    const hex = /^#x/i.test(reference);
    const code = parseInt(reference.slice(hex ? 2 : 1), hex ? 16 : 10);
    return code === 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)
      ? '�'
      : String.fromCodePoint(replacements.get(code) ?? code);
  }
  for (let length = Math.min(reference.length, 32); length > 0; length--) {
    const name = reference.slice(0, length);
    if (Object.hasOwn(references, name)) {
      const rest = reference.slice(length);
      if (
        attribute &&
        !name.endsWith(';') &&
        /^[a-z0-9=]/i.test(rest || following)
      ) {
        return whole;
      }
      return references[name] + rest;
    }
  }
  return whole;
}

const decodeHtml = (text, attribute = false) =>
  text.replace(
    /&(#(?:x[0-9a-f]+|[0-9]+);?|[a-z][a-z0-9]*;?)/gi,
    (whole, reference, offset) =>
      decodeReference(
        whole,
        reference,
        attribute,
        text[offset + whole.length] ?? ''
      )
  );

function attributes(source) {
  const result = Object.create(null);
  let count = 0;
  const pattern =
    /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    if (++count > 1000) {
      throw new RangeError('Account HTML attribute limit exceeded');
    }
    const name = match[1].toLowerCase();
    if (!Object.hasOwn(result, name)) {
      result[name] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? '', true);
    }
  }
  return result;
}

/** A single forward scan handles quoted > characters without backtracking. */
function tagAt(source, start) {
  let quote;
  for (let end = start + 1; end < source.length; end++) {
    const char = source[end];
    if (quote) {
      if (char === quote) {
        quote = undefined;
      }
    } else if (char === '"' || char === "'") {
      quote = char;
    } else if (char === '<') {
      return { end: start + 1 };
    } else if (char === '>') {
      const body = source.slice(start + 1, end);
      const name = /^(\/?)([a-z][a-z0-9-]*)([\s\S]*)$/i.exec(body);
      return {
        end: end + 1,
        name: name?.[2].toLowerCase(),
        closing: Boolean(name?.[1]),
        fields: name?.[3] ?? '',
        selfClosing: /\/\s*$/.test(body),
      };
    }
  }
  return { end: source.length, unterminated: true };
}

const styles = {
  b: 'Bold',
  strong: 'Bold',
  i: 'Italic',
  em: 'Italic',
  u: 'Underline',
  ins: 'Underline',
  s: 'Strike',
  del: 'Strike',
  strike: 'Strike',
  spoiler: 'Spoiler',
  'tg-spoiler': 'Spoiler',
};
const dateFlags = [
  'relative',
  'short-time',
  'long-time',
  'short-date',
  'long-date',
  'day-of-week',
];
const snake = (value) => value.replaceAll('-', '_');

function specialEntity(name, attrs, open) {
  if (name === 'span' && attrs.class?.split(/\s+/).includes('tg-spoiler')) {
    return { _: 'messageEntitySpoiler' };
  }
  if (name === 'blockquote') {
    return {
      _: 'messageEntityBlockquote',
      ...(Object.hasOwn(attrs, 'expandable') ? { collapsed: true } : {}),
    };
  }
  if (name === 'pre') {
    return { _: 'messageEntityPre', language: attrs.language ?? '' };
  }
  if (name === 'code') {
    return codeEntity(attrs, open);
  }
  if (name === 'a' && attrs.href) {
    const mention = /^tg:\/\/user\?id=(\d+)$/.exec(attrs.href);
    return mention
      ? { _: 'messageEntityMentionName', user_id: identifier(mention[1]) }
      : { _: 'messageEntityTextUrl', url: attrs.href };
  }
  return extendedEntity(name, attrs);
}

function extendedEntity(name, attrs) {
  if (name === 'tg-emoji') {
    return {
      _: 'messageEntityCustomEmoji',
      document_id: identifier(attrs['emoji-id']),
    };
  }
  if (name === 'tg-date') {
    return dateEntity(attrs);
  }
  if (name === 'tg-time') {
    return markupDate(attrs.unix, attrs.format ?? '');
  }
  return undefined;
}

function codeEntity(attrs, open) {
  const pre = open.findLast((tag) => tag.entity?._ === 'messageEntityPre');
  if (!pre) {
    return { _: 'messageEntityCode' };
  }
  if (attrs.class?.startsWith('language-')) {
    pre.entity.language = attrs.class.slice(9);
  }
  return undefined;
}

function dateEntity(attrs) {
  if (
    !/^\d+$/.test(attrs.timestamp ?? '') ||
    Number(attrs.timestamp) > 2147483647
  ) {
    throw new RangeError('HTML date requires timestamp seconds');
  }
  return {
    _: 'messageEntityFormattedDate',
    date: Number(attrs.timestamp),
    ...Object.fromEntries(
      dateFlags
        .filter((flag) => Object.hasOwn(attrs, flag))
        .map((flag) => [snake(flag), true])
    ),
  };
}

class HtmlReader {
  output = new MarkupOutput();
  open = [];
  entities = [];
  count = 0;
  close(index) {
    while (this.open.length > index) {
      const tag = this.open.pop();
      if (tag.entity) {
        tag.entity.length = this.output.length - tag.entity.offset;
        this.entities.push(tag.entity);
      }
    }
  }
  tag(tag) {
    if (++this.count > 100000) {
      throw new RangeError('Account markup token limit exceeded');
    }
    if (!tag.name) {
      return;
    }
    if (tag.closing) {
      const index = this.open.findLastIndex((entry) => entry.name === tag.name);
      if (index >= 0) {
        this.close(index);
      }
      return;
    }
    if (tag.name === 'br') {
      this.output.append('\n');
      return;
    }
    if (
      tag.selfClosing ||
      ['img', 'hr', 'input', 'meta', 'link', 'wbr'].includes(tag.name)
    ) {
      return;
    }
    if (this.open.length >= 64) {
      throw new RangeError('Account markup nesting limit exceeded');
    }
    const attrs = attributes(tag.fields);
    const entity = Object.hasOwn(styles, tag.name)
      ? { _: `messageEntity${styles[tag.name]}` }
      : specialEntity(tag.name, attrs, this.open);
    if (entity) {
      if (++this.entityCount > 1000) {
        throw new RangeError('Account parser entity limit exceeded');
      }
      Object.assign(entity, { offset: this.output.length, length: 0 });
    }
    this.open.push({ name: tag.name, entity });
  }
  entityCount = 0;
  parse(source) {
    let cursor = 0;
    while (cursor < source.length) {
      const start = source.indexOf('<', cursor);
      if (start < 0) {
        this.output.append(decodeHtml(source.slice(cursor)));
        break;
      }
      this.output.append(decodeHtml(source.slice(cursor, start)));
      if (source.startsWith('<!--', start)) {
        const end = source.indexOf('-->', start + 4);
        cursor = end < 0 ? source.length : end + 3;
        continue;
      }
      const tag = tagAt(source, start);
      if (tag.unterminated || !tag.name) {
        this.output.append(source.slice(start, tag.end));
      } else {
        this.tag(tag);
      }
      cursor = tag.end;
    }
    this.close(0);
    const text = this.output.toString();
    for (const entity of this.entities) {
      if (entity._ === 'messageEntityTextUrl') {
        const body = text.slice(entity.offset, entity.offset + entity.length);
        if (entity.url === body || entity.url === `mailto:${body}`) {
          entity._ =
            entity.url === body ? 'messageEntityUrl' : 'messageEntityEmail';
          delete entity.url;
        }
      }
    }
    return markupResult(text, this.entities);
  }
}

const tags = {
  messageEntityBold: ['<strong>', '</strong>'],
  messageEntityItalic: ['<em>', '</em>'],
  messageEntityUnderline: ['<u>', '</u>'],
  messageEntityStrike: ['<del>', '</del>'],
  messageEntitySpoiler: ['<tg-spoiler>', '</tg-spoiler>'],
  messageEntityCode: ['<code>', '</code>'],
};

function markupFor(entity, text) {
  if (Object.hasOwn(tags, entity._)) {
    return tags[entity._];
  }
  if (entity._ === 'messageEntityBlockquote') {
    return [
      entity.collapsed ? '<blockquote expandable>' : '<blockquote>',
      '</blockquote>',
    ];
  }
  if (entity._ === 'messageEntityPre') {
    return entity.language
      ? [
          `<pre><code class="language-${escapeHtml(entity.language)}">`,
          '</code></pre>',
        ]
      : ['<pre>', '</pre>'];
  }
  if (entity._ === 'messageEntityCustomEmoji') {
    return [
      `<tg-emoji emoji-id="${identifier(entity.document_id)}">`,
      '</tg-emoji>',
    ];
  }
  if (entity._ === 'messageEntityFormattedDate') {
    if (
      !Number.isSafeInteger(entity.date) ||
      entity.date < 0 ||
      entity.date > 2147483647
    ) {
      throw new RangeError('HTML date requires timestamp seconds');
    }
    const flags = dateFlags
      .filter((flag) => entity[snake(flag)])
      .map((flag) => ` ${flag}`)
      .join('');
    return [`<tg-date timestamp="${entity.date}"${flags}>`, '</tg-date>'];
  }
  const body = text.slice(entity.offset, entity.offset + entity.length);
  const links = {
    messageEntityEmail: () => `mailto:${body}`,
    messageEntityUrl: () => body,
    messageEntityTextUrl: () => entity.url,
    messageEntityMentionName: () =>
      `tg://user?id=${identifier(entity.user_id)}`,
  };
  return Object.hasOwn(links, entity._)
    ? [`<a href="${escapeHtml(links[entity._]())}">`, '</a>']
    : undefined;
}

function renderHtml(text, entities) {
  const spans = markupNesting(markupEntities(text, entities));
  const marks = spans.flatMap((entity, order) => {
    const markup = markupFor(entity, text);
    return markup
      ? [
          { at: entity.offset, order, open: true, value: markup[0] },
          {
            at: entity.offset + entity.length,
            order,
            open: false,
            value: markup[1],
          },
        ]
      : [];
  });
  marks.sort(
    (a, b) =>
      a.at - b.at ||
      Number(a.open) - Number(b.open) ||
      (a.open ? a.order - b.order : b.order - a.order)
  );
  const output = new MarkupOutput();
  let cursor = 0;
  for (const mark of marks) {
    output.append(escapeHtml(text.slice(cursor, mark.at)));
    output.append(mark.value);
    cursor = mark.at;
  }
  output.append(escapeHtml(text.slice(cursor)));
  return output.toString();
}

/** Independent HTML/entity conversion; no optional SDK or DOM is required. */
export class HTMLParser {
  static parse(source) {
    return new HtmlReader().parse(markupText(source));
  }
  static unparse(text, entities = []) {
    return renderHtml(markupText(text), entities);
  }
}
