// Run with: node --stack-size=512 --max-old-space-size=128 experiments/request-limits.mjs
// Both probes have finite inputs, independently of the request guards.
import assert from 'node:assert/strict';
import { objectRequest, requestOf } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';

let request = { _: 'help.getConfig' };
for (let index = 0; index < 2000; index++) {
  request = { _: 'invokeWithoutUpdates', query: request };
}
assert.throws(() => objectRequest(requestOf(request)), /depth limit/i);
assert.throws(() => new TlCodec().encode(request), /depth limit/i);
const ids = new Array(17);
Object.defineProperty(ids, 0, {
  get() {
    throw new Error('Rejected vector was visited');
  },
});
assert.throws(
  () =>
    objectRequest(requestOf('users.getUsers', { id: ids }), { maxVector: 16 }),
  /vector length/i
);
console.log('Finite depth/vector probes rejected before excessive traversal');
