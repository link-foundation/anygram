import assert from 'node:assert/strict';
import { Api } from '../src/api.js';
import { gramView } from '../src/gram-style.js';

const count = 10000;
const views = gramView(
  Array.from({ length: count }, () => ({ _: 'inputPeerSelf' }))
);
for (const value of views) {
  assert(value instanceof Api.InputPeerSelf);
  assert.equal(value.getBytes().length, 4);
}
assert.equal(views.length, count);
console.log(
  JSON.stringify({ views: count, maxRssKiB: process.resourceUsage().maxRSS })
);
