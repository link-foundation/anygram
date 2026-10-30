import assert from 'node:assert/strict';
import { HTMLParser } from '../src/account-html.js';

// Finite input sizes; invoke with the documented process heap/stack limits.
const size = 4 * 1024 * 1024;
for (const source of ['x'.repeat(size), `<a title="${'x'.repeat(size - 10)}`]) {
  assert.equal(HTMLParser.parse(source)[0], source);
}
assert.throws(() => HTMLParser.parse('<'.repeat(100001)), /token limit/);
assert.throws(() => HTMLParser.parse('<br>'.repeat(100001)), /token limit/);
assert.throws(() => HTMLParser.parse('<b>'.repeat(65)), /nesting limit/);
assert.equal(HTMLParser.parse(`x&${'a'.repeat(size - 3)}y`)[0].length, size);
console.log(
  `Bounded HTML probes pass; max RSS ${process.resourceUsage().maxRSS} KiB`
);
