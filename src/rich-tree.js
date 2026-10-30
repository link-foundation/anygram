import { canonicalValue, requestLimits } from './requests.js';
import { escapeBounded } from './text-escape.js';

const metadata = new Set([
  'originalArgs',
  'className',
  'classType',
  'CONSTRUCTOR_ID',
  'SUBCLASS_OF_ID',
]);
const maxNodes = 100000;
const maxInput = 4 * 1024 * 1024;
const maxOutput = 16 * 1024 * 1024;

/** Preflight before normalization so repeated children cannot amplify its work. */
export function prepareRich(value) {
  let nodes = 0;
  let size = 0;
  function visit(value, depth) {
    if (++nodes > maxNodes || depth > requestLimits.maxDepth) {
      throw new RangeError('Rich message tree limit exceeded');
    }
    if (typeof value === 'string') {
      size += value.length;
    } else if (value instanceof Uint8Array) {
      size += value.byteLength;
    } else if (Array.isArray(value)) {
      if (value.length > requestLimits.maxVector) {
        throw new RangeError('Rich message vector limit exceeded');
      }
      for (const entry of value) {
        visit(entry, depth + 1);
      }
    } else if (value && typeof value === 'object') {
      for (const [key, entry] of Object.entries(value)) {
        if (!metadata.has(key)) {
          visit(entry, depth + 1);
        }
      }
    }
    if (size > maxInput) {
      throw new RangeError('Rich message input size limit exceeded');
    }
  }
  visit(value, 0);
  return canonicalValue(value);
}

export function checkedRichOutput(text) {
  if (text.length > maxOutput) {
    throw new RangeError('Rich message output size limit exceeded');
  }
  return text;
}

export function escapeRich(value, mode) {
  const text = typeof value === 'string' ? value : String(value ?? '');
  if (mode === 'html') {
    const entities = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' };
    return escapeBounded(
      text,
      entities,
      maxOutput,
      'Rich message output size limit exceeded'
    );
  }
  return mode === 'md' ? text.replace(/([\\`*_[\]|~])/g, '\\$1') : text;
}
