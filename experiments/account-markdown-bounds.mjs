import assert from 'node:assert/strict';
import { MarkdownParser, MarkdownV2Parser } from '../src/account-markdown.js';

// All sizes are finite; use the documented process heap and stack limits.
const size = 4 * 1024 * 1024;
for (const Parser of [MarkdownParser, MarkdownV2Parser]) {
  for (const source of [
    'x'.repeat(size),
    `[${'x'.repeat(size - 1)}`,
    `\`\`\`${'x'.repeat(size - 3)}`,
  ]) {
    assert.equal(Parser.parse(source)[0], source);
  }
  assert.throws(() => Parser.parse('\\a'.repeat(100001)), /token limit/);
  assert.throws(() => Parser.parse('[x]('.repeat(50001)), /token limit/);
  assert.throws(() => Parser.parse('>a\n'.repeat(100001)), /token limit/);
  assert.equal(
    Parser.parse(`${'['.repeat(40000)}\`body\`tail`)[0].length,
    40008
  );
}
console.log(
  `Bounded Markdown probes pass; max RSS ${process.resourceUsage().maxRSS} KiB`
);
