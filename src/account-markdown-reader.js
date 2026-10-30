import { MarkupOutput, markupResult } from './account-markup.js';
import { markupLink } from './account-markup-links.js';

const legacy = { '**': 'Bold', __: 'Italic', '~~': 'Strike' };
const modern = {
  '*': 'Bold',
  _: 'Italic',
  __: 'Underline',
  '~': 'Strike',
  '||': 'Spoiler',
};

function escaped(source, at) {
  let count = 0;
  while (at > 0 && source[--at] === '\\') {
    count++;
  }
  return count % 2 !== 0;
}

/** Monotone lookups cache both a found terminator and exhausted searches. */
class Terminators {
  constructor(source) {
    this.source = source;
    this.positions = new Map();
  }
  cached(marker, start) {
    const cached = this.positions.get(marker);
    if (
      cached &&
      start >= cached.start &&
      (cached.at < 0 || cached.at >= start)
    ) {
      return cached.at;
    }
    return undefined;
  }
  find(marker, start) {
    const cached = this.cached(marker, start);
    if (cached !== undefined) {
      return cached;
    }
    let at = this.source.indexOf(marker, start);
    while (at >= 0 && escaped(this.source, at)) {
      at = this.source.indexOf(marker, at + marker.length);
    }
    this.positions.set(marker, { start, at });
    return at;
  }
  code(at) {
    const marker = this.source.startsWith('```', at) ? '```' : '`';
    const end = this.find(marker, at + marker.length);
    if (end < 0) {
      return undefined;
    }
    let value = this.source
      .slice(at + marker.length, end)
      .replace(/\\([\\`])/g, '$1');
    let language = '';
    if (marker.length === 3) {
      const header = /^([\w.+-]*)\r?\n/.exec(value);
      if (header) {
        language = header[1];
        value = value.slice(header[0].length);
      }
    }
    return {
      end: end + marker.length,
      value,
      entity:
        marker.length === 3
          ? { _: 'messageEntityPre', language }
          : { _: 'messageEntityCode' },
    };
  }
  label(start) {
    const cached = this.cached('label', start);
    if (cached !== undefined) {
      return cached;
    }
    const pattern = /[\\`\]]/g;
    pattern.lastIndex = start;
    let match;
    while ((match = pattern.exec(this.source))) {
      if (match[0] === '\\') {
        pattern.lastIndex++;
      } else if (match[0] === '`') {
        pattern.lastIndex = this.code(match.index)?.end ?? pattern.lastIndex;
      } else {
        this.positions.set('label', { start, at: match.index });
        return match.index;
      }
    }
    this.positions.set('label', { start, at: -1 });
    return -1;
  }
}

function quoteAt(source, at) {
  if (at > 0 && source[at - 1] !== '\n') {
    return undefined;
  }
  let cursor = source.startsWith('**>', at) ? at + 2 : at;
  if (source[cursor] !== '>') {
    return undefined;
  }
  const lines = [];
  while (source[cursor] === '>') {
    if (lines.length >= 100000) {
      throw new RangeError('Account markup token limit exceeded');
    }
    const newline = source.indexOf('\n', cursor);
    const end = newline < 0 ? source.length : newline;
    lines.push(source.slice(cursor + 1, end));
    cursor = end;
    if (source[cursor + 1] !== '>' || newline < 0) {
      break;
    }
    cursor++;
  }
  return { body: lines.join('\n'), end: cursor };
}

function pairMarkers(tokens) {
  const open = new Map();
  for (const token of tokens) {
    if (token.marker) {
      const previous = open.get(token.marker);
      if (previous) {
        previous.partner = token;
        token.partner = previous;
        token.closing = true;
        open.delete(token.marker);
      } else {
        open.set(token.marker, token);
      }
    }
  }
  return tokens;
}

class MarkdownReader {
  constructor(v2) {
    this.v2 = v2;
    this.styles = v2 ? modern : legacy;
    this.work = 0;
    this.output = new MarkupOutput();
    this.entities = [];
  }
  tokens(source, depth = 0, links = true, quotes = true) {
    if (depth >= 64) {
      throw new RangeError('Account markup nesting limit exceeded');
    }
    const tokens = [];
    const search = new Terminators(source);
    const pattern = /[\\`*_~|[!>\r]/g;
    let cursor = 0;
    let match;
    while ((match = pattern.exec(source))) {
      if (++this.work > 100000) {
        throw new RangeError('Account markup token limit exceeded');
      }
      if (match.index > cursor) {
        tokens.push({ value: source.slice(cursor, match.index) });
      }
      const node = this.token(source, match.index, search, {
        depth,
        links,
        quotes,
      });
      tokens.push(node);
      cursor = node.end;
      pattern.lastIndex = cursor;
    }
    if (cursor < source.length) {
      tokens.push({ value: source.slice(cursor) });
    }
    return pairMarkers(tokens);
  }
  token(source, at, search, options) {
    const char = source[at];
    if (
      char === '\\' &&
      source.charCodeAt(at + 1) >= 1 &&
      source.charCodeAt(at + 1) <= 126
    ) {
      return { value: source[at + 1], end: at + 2 };
    }
    if (char === '`') {
      const code = search.code(at);
      if (code) {
        return code;
      }
      const marker = source.startsWith('```', at) ? '```' : '`';
      return { value: marker, end: at + marker.length };
    }
    const compound = this.compound(source, at, search, options);
    if (compound) {
      return compound;
    }
    if (char === '\r' && this.v2) {
      return { value: '', end: at + 1 };
    }
    const double = source.slice(at, at + 2);
    const marker = Object.hasOwn(this.styles, double) ? double : char;
    return Object.hasOwn(this.styles, marker)
      ? {
          marker,
          value: marker,
          end: at + marker.length,
          entity: { _: `messageEntity${this.styles[marker]}` },
        }
      : { value: char, end: at + 1 };
  }
  compound(source, at, search, { depth, links, quotes }) {
    const quote = this.v2 && quotes ? quoteAt(source, at) : undefined;
    if (quote) {
      const children = this.tokens(quote.body, depth + 1, links, false);
      const last = children.at(-1);
      const collapsed = last?.marker === '||' && !last.partner;
      if (collapsed) {
        children.pop();
      }
      return {
        children,
        end: quote.end,
        entity: {
          _: 'messageEntityBlockquote',
          ...(collapsed ? { collapsed: true } : {}),
        },
      };
    }
    return this.link(source, at, search, depth, links);
  }
  link(source, at, search, depth, links) {
    const image = source.startsWith('![', at);
    if (!links || (source[at] !== '[' && !image)) {
      return undefined;
    }
    const start = at + (image ? 2 : 1);
    const end = search.label(start);
    const finish =
      end >= 0 && source[end + 1] === '(' ? search.find(')', end + 2) : -1;
    if (finish < 0) {
      return undefined;
    }
    const url = source.slice(end + 2, finish).replace(/\\([\\)])/g, '$1');
    const children = this.tokens(
      source.slice(start, end),
      depth + 1,
      false,
      false
    );
    const specialImage = image && /^tg:\/\/(?:emoji\?|time\?)/.test(url);
    return {
      children,
      end: finish + 1,
      url,
      image: specialImage,
      prefix: image && !specialImage ? '!' : '',
    };
  }
  append(tokens) {
    for (const token of tokens) {
      if (token.marker && token.partner) {
        if (token.closing) {
          this.add(token.entity, token.partner.offset);
        } else {
          token.offset = this.output.length;
        }
        continue;
      }
      this.output.append(token.prefix ?? '');
      const offset = this.output.length;
      const part = this.output.parts.length;
      if (token.children) {
        this.append(token.children);
      } else {
        this.output.append(token.value);
      }
      if (token.url !== undefined) {
        const body = this.output.parts.slice(part).join('');
        this.add(markupLink(token.url, body, token.image), offset);
      } else if (token.entity && !token.marker) {
        this.add(token.entity, offset);
      }
    }
  }
  add(entity, offset) {
    if (this.entities.length >= 1000) {
      throw new RangeError('Account parser entity limit exceeded');
    }
    this.entities.push({
      ...entity,
      offset,
      length: this.output.length - offset,
    });
  }
}

export function parseMarkdown(source, v2) {
  const reader = new MarkdownReader(v2);
  reader.append(reader.tokens(source));
  return markupResult(reader.output.toString(), reader.entities, v2);
}
