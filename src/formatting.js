import { UnsupportedError } from './errors.js';

const styles = new Set([
  'bold',
  'italic',
  'underline',
  'strikethrough',
  'spoiler',
]);
const tags = new Map();

function invalidNesting(a, b) {
  return (
    b.offset + b.length > a.offset + a.length ||
    ['code', 'pre'].includes(a.type) ||
    ['code', 'pre'].includes(b.type) ||
    (!styles.has(a.type) && !styles.has(b.type))
  );
}

function validateEntities(text, entities) {
  if (entities.length > 1000) {
    throw new RangeError('Formatted text entity limit exceeded');
  }
  for (const entity of entities) {
    if (
      !Number.isSafeInteger(entity.offset) ||
      !Number.isSafeInteger(entity.length) ||
      entity.offset < 0 ||
      entity.length < 1 ||
      entity.offset + entity.length > text.length
    ) {
      throw new RangeError('Formatted text entity exceeds text bounds');
    }
  }
  for (let index = 0; index < entities.length; index++) {
    const a = entities[index];
    for (const b of entities.slice(index + 1)) {
      if (b.offset >= a.offset + a.length) {
        break;
      }
      if (invalidNesting(a, b)) {
        throw new TypeError(
          'Invalid nested or overlapping formatting entities'
        );
      }
    }
  }
}

/** Immutable Telegram text and UTF-16 entity offsets; no markup parser. */
export class FormattedText {
  constructor(text, entities = []) {
    if (typeof text !== 'string') {
      throw new TypeError('Formatted text must be a string');
    }
    const sorted = entities
      .map((entity) => ({ ...entity }))
      .sort((a, b) => a.offset - b.offset || b.length - a.length);
    validateEntities(text, sorted);
    this.text = text;
    this.entities = Object.freeze(sorted.map(Object.freeze));
    Object.freeze(this);
  }
  get caption() {
    return this.text;
  }
  get caption_entities() {
    return this.entities;
  }
  toString() {
    return this.text;
  }
  plain(value) {
    return fmt`${this}${value}`;
  }
}

function asText(value) {
  if (typeof value?.text === 'string') {
    return new FormattedText(value.text, value.entities);
  }
  if (typeof value?.caption === 'string') {
    return new FormattedText(value.caption, value.caption_entities);
  }
  return new FormattedText(String(value));
}

export function fmt(strings, ...values) {
  if (!Array.isArray(strings) || !strings.raw) {
    return asText(strings);
  }
  let text = strings[0];
  const entities = [];
  const open = [];
  for (let index = 0; index < values.length; index++) {
    const value = values[index];
    if (tags.has(value)) {
      const type = tags.get(value);
      if (open.at(-1)?.type === type) {
        const entity = open.pop();
        const length = text.trimEnd().length - entity.offset;
        if (length > 0) {
          entities.push({ ...entity, length });
        }
      } else {
        open.push({ type, offset: text.length });
      }
    } else {
      const fragment = asText(value);
      entities.push(
        ...fragment.entities.map((entity) => ({
          ...entity,
          offset: entity.offset + text.length,
        }))
      );
      text += fragment.text;
    }
    text += strings[index + 1];
  }
  if (open.length) {
    throw new TypeError('Unclosed formatting tag');
  }
  return new FormattedText(text, entities);
}

function wrap(type, value, fields = {}) {
  const fragment = asText(value);
  const length = fragment.text.trimEnd().length;
  return new FormattedText(fragment.text, [
    ...(length ? [{ type, ...fields, offset: 0, length }] : []),
    ...fragment.entities,
  ]);
}

/** Runtime i18n templates: {name} inserts values; {{ and }} escape braces. */
export function formatTemplate(template, values = {}) {
  if (typeof template !== 'string') {
    throw new TypeError('A runtime text template must be a string');
  }
  const parts = [];
  const entities = [];
  let offset = 0;
  let end = 0;
  for (const match of template.matchAll(/\{\{|\}\}|\{([a-zA-Z_]\w*)\}/g)) {
    const prefix = template.slice(end, match.index);
    parts.push(prefix);
    offset += prefix.length;
    let value;
    if (match[1]) {
      if (!Object.hasOwn(values, match[1])) {
        throw new TypeError(`Missing template value ${match[1]}`);
      }
      value = asText(values[match[1]]);
    } else {
      value = asText(match[0][0]);
    }
    parts.push(value.text);
    entities.push(
      ...value.entities.map((entity) => ({
        ...entity,
        offset: entity.offset + offset,
      }))
    );
    offset += value.text.length;
    end = match.index + match[0].length;
  }
  parts.push(template.slice(end));
  return new FormattedText(parts.join(''), entities);
}
function style(type) {
  const format = (value, ...parts) => wrap(type, fmt(value, ...parts));
  tags.set(format, type);
  return format;
}
export const bold = style('bold');
export const italic = style('italic');
export const underline = style('underline');
export const strikethrough = style('strikethrough');
export const spoiler = style('spoiler');
export const code = style('code');
export const blockquote = style('blockquote');
export const link = (value, url) => wrap('text_link', value, { url });
export const pre = (value, language = '') => wrap('pre', value, { language });

for (const [name, format] of Object.entries({
  bold,
  italic,
  underline,
  strikethrough,
  spoiler,
  code,
  blockquote,
})) {
  FormattedText.prototype[name] = function (value) {
    return fmt`${this}${format(value)}`;
  };
}
export {
  FormattedText as FormattedString,
  bold as b,
  italic as i,
  underline as u,
  strikethrough as s,
};

export function botTextParams(params) {
  let result = params;
  for (const [field, key] of [
    ['text', 'entities'],
    ['caption', 'caption_entities'],
  ]) {
    if (typeof params[field]?.text !== 'string') {
      continue;
    }
    const formatted = asText(params[field]);
    result = { ...result, [field]: formatted.text, [key]: formatted.entities };
    delete result.parse_mode;
  }
  return result;
}

const entityTypes = {
  bold: 'Bold',
  italic: 'Italic',
  underline: 'Underline',
  strikethrough: 'Strike',
  spoiler: 'Spoiler',
  code: 'Code',
  pre: 'Pre',
  text_link: 'TextUrl',
  mention: 'Mention',
  hashtag: 'Hashtag',
  cashtag: 'Cashtag',
  bot_command: 'BotCommand',
  url: 'Url',
  email: 'Email',
  phone_number: 'Phone',
  custom_emoji: 'CustomEmoji',
  blockquote: 'Blockquote',
  expandable_blockquote: 'Blockquote',
};
export function mtprotoEntities(entities) {
  return entities.map((entity) => {
    if (entity._ || entity.className) {
      return entity;
    }
    const { type, offset, length, ...fields } = entity;
    if (!entityTypes[type]) {
      throw new UnsupportedError(`MTProto formatting entity ${type}`);
    }
    if (type === 'custom_emoji') {
      fields.document_id = BigInt(fields.custom_emoji_id);
      delete fields.custom_emoji_id;
    }
    if (type === 'expandable_blockquote') {
      fields.collapsed = true;
    }
    return {
      _: `messageEntity${entityTypes[type]}`,
      offset,
      length,
      ...fields,
    };
  });
}

export function mtprotoTextParams(params) {
  let result = params;
  if (typeof params.message?.text === 'string') {
    result = {
      ...result,
      message: params.message.text,
      entities: params.message.entities,
    };
  }
  if (result.entities) {
    result = { ...result, entities: mtprotoEntities(result.entities) };
  }
  if (result.multi_media) {
    result = {
      ...result,
      multi_media: result.multi_media.map(mtprotoTextParams),
    };
  }
  return result;
}
