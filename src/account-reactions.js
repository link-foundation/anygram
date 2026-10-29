import { canonicalValue } from './requests.js';

function customId(value) {
  if (
    !['number', 'bigint', 'string'].includes(typeof value) ||
    (typeof value === 'string' && !/^-?\d+$/.test(value)) ||
    (typeof value === 'number' && !Number.isSafeInteger(value))
  ) {
    throw new TypeError('Custom reaction IDs require an exact integer');
  }
  return BigInt(value);
}

export function reactionOf(value) {
  if (typeof value === 'string') {
    return { _: 'reactionEmoji', emoticon: value };
  }
  value = canonicalValue(value);
  if (typeof value === 'bigint' || typeof value === 'number') {
    return { _: 'reactionCustomEmoji', document_id: customId(value) };
  }
  if (value?._ === 'reactionCustomEmoji') {
    return { ...value, document_id: customId(value.document_id) };
  }
  if (
    (value?._ === 'reactionEmoji' && typeof value.emoticon === 'string') ||
    ['reactionEmpty', 'reactionPaid'].includes(value?._)
  ) {
    return value;
  }
  throw new TypeError('Expected an emoji, exact custom emoji ID or Reaction');
}

export function reactionList(value) {
  value = canonicalValue(value);
  return value === null || value === undefined
    ? []
    : (Array.isArray(value) ? value : [value]).map(reactionOf);
}
