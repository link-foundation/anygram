function entitySpans(entities, offset) {
  const spans = new Map();
  for (const entity of entities) {
    if (entity.type === 'text_link' || entity.type === 'text_mention') {
      spans.set(entity.offset - offset, entity.length);
    }
  }
  return spans;
}

/** Telegraf command words, with quoted/escaped text and entity boundaries. */
export function commandArgs(text, entities = [], offset = 0) {
  const spans = entitySpans(entities, offset);
  const result = [];
  let start = 0;
  let quote;
  let escaped = '';
  const flush = (end) => {
    if (start !== end) {
      result.push(escaped + text.slice(start, end));
      quote = undefined;
    }
    escaped = '';
    start = end + 1;
  };
  for (let index = 0; index < text.length; index++) {
    const value = text[index];
    const length = spans.get(index);
    if (length) {
      flush(index);
      start--;
      index += length;
      flush(index);
    } else if (value === '"' || value === "'") {
      if (!quote) {
        flush(index);
        quote = value;
      } else if (quote === value) {
        flush(index);
      }
    } else if (value === '\n' || (value === ' ' && !quote)) {
      flush(index);
    } else if (value === '\\') {
      escaped += text.slice(start, index);
      start = ++index;
    }
  }
  if (start < text.length) {
    flush(text.length);
  }
  return result;
}
