import { Api } from './api.js';
import {
  canonicalValue,
  gramRequest,
  requestOf,
  schemaDefinition,
} from './requests.js';

export function markupText(text) {
  if (typeof text !== 'string') {
    throw new TypeError('Account parser text must be a string');
  }
  if (text.length > 4 * 1024 * 1024) {
    throw new RangeError('Account parser text limit exceeded');
  }
  return text;
}

export function markupEntities(text, entities) {
  if (!Array.isArray(entities)) {
    throw new TypeError('Account parser entities must be an array');
  }
  if (entities.length > 1000) {
    throw new RangeError('Account parser entity limit exceeded');
  }
  const result = canonicalValue(entities);
  for (const entity of result) {
    if (
      schemaDefinition(entity?._)?.type !== 'MessageEntity' ||
      !Number.isSafeInteger(entity.offset) ||
      !Number.isSafeInteger(entity.length) ||
      entity.offset < 0 ||
      entity.length < 0 ||
      entity.offset + entity.length > text.length
    ) {
      throw new RangeError('Account parser entity exceeds text bounds');
    }
  }
  return result;
}

/** Validate nesting before rendering; no recursion follows caller objects. */
export function markupNesting(entities) {
  const stack = [];
  const sorted = entities
    .filter((entity) => entity.length > 0)
    .toSorted((a, b) => a.offset - b.offset || b.length - a.length);
  const isolated = new Set([
    'messageEntityCode',
    'messageEntityPre',
    'messageEntityFormattedDate',
  ]);
  for (const entity of sorted) {
    while (
      stack.length &&
      entity.offset >= stack.at(-1).offset + stack.at(-1).length
    ) {
      stack.pop();
    }
    const parent = stack.at(-1);
    if (
      parent &&
      entity.offset + entity.length > parent.offset + parent.length
    ) {
      throw new TypeError('Formatting entities overlap without containment');
    }
    if (parent && (isolated.has(entity._) || isolated.has(parent._))) {
      throw new TypeError('Code, pre and date entities cannot be nested');
    }
    if (stack.length >= 64) {
      throw new RangeError('Account markup nesting limit exceeded');
    }
    stack.push(entity);
  }
  return sorted;
}

/** Clip every span independently when the SDK-style outer trim removes text. */
export function markupResult(text, entities, trim = true) {
  const start = trim ? text.length - text.trimStart().length : 0;
  const end = trim ? text.trimEnd().length : text.length;
  const output = text.slice(start, Math.max(start, end));
  const spans = entities.flatMap((entity) => {
    const offset = Math.max(start, entity.offset);
    const finish = Math.min(end, entity.offset + entity.length);
    const length = text
      .slice(offset, Math.max(offset, finish))
      .trimEnd().length;
    return length ? [{ ...entity, offset: offset - start, length }] : [];
  });
  markupNesting(markupEntities(output, spans));
  return [output, spans.map((entity) => gramRequest(Api, requestOf(entity)))];
}

/** Output parts and tag work have finite counts and UTF-16 text bounds. */
export class MarkupOutput {
  parts = [];
  length = 0;
  append(text) {
    if (this.parts.length >= 100000) {
      throw new RangeError('Account markup token limit exceeded');
    }
    this.length += text.length;
    if (this.length > 4 * 1024 * 1024) {
      throw new RangeError('Account parser text limit exceeded');
    }
    this.parts.push(text);
  }
  toString() {
    return this.parts.join('');
  }
}
