import assert from 'node:assert/strict';
import { HTMLParser } from '../src/account-html.js';
import { renderRichText } from '../src/rich-messages.js';

// Run each finite case with --max-old-space-size=64 --stack-size=512.
if (process.argv[2] === 'html') {
  assert.throws(() => HTMLParser.unparse('&'.repeat(900000)), RangeError);
} else {
  assert.throws(
    () =>
      renderRichText(
        { _: 'textPlain', text: '"'.repeat(3 * 1024 * 1024) },
        'html'
      ),
    RangeError
  );
}
console.log(
  `Rejected oversized escaped output; max RSS ${process.resourceUsage().maxRSS} KiB`
);
