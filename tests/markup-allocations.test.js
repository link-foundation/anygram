import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { HTMLParser } from '../src/account-html.js';
import { renderRichText } from '../src/rich-messages.js';
import { markupAllocations } from '../experiments/markup-allocation-probe.mjs';

for (const [name, limit, action] of [
  [
    'account HTML',
    4 * 1024 * 1024,
    () => HTMLParser.unparse('&'.repeat(900000)),
  ],
  [
    'rich HTML',
    16 * 1024 * 1024,
    () =>
      renderRichText(
        { _: 'textPlain', text: '"'.repeat(3 * 1024 * 1024) },
        'html'
      ),
  ],
]) {
  it(`rejects oversized ${name} before materializing escaped output`, () => {
    const result = markupAllocations(action);
    assert(result.error instanceof RangeError);
    assert(
      result.codeUnits <= limit,
      `Constructed ${result.codeUnits} escaped code units before rejecting a ${limit} budget`
    );
  });
}
