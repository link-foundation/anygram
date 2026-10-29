import assert from 'node:assert/strict';
import { normalize } from '../src/operations.js';
import { gramView } from '../src/gram-style.js';

// Finite probes; run with --stack-size=512 --max-old-space-size=128.
let nested = 7;
for (let index = 0; index < 2000; index++) {
  nested = [nested];
}
const vector = new Array(100001);
for (const convert of [normalize, gramView]) {
  assert.throws(() => convert(nested), /depth limit/i);
  assert.throws(() => convert(vector), /vector length/i);
  assert.deepEqual(convert([[7n, false]]), [[7n, false]]);
}
console.log('Finite response-array depth/vector probes passed');
