import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Anygram, createAdapter } from '../src/index.js';
import { normalize } from '../src/operations.js';
import { gramView } from '../src/gram-style.js';

function recursiveArray() {
  let reads = 0;
  const value = [];
  Object.defineProperty(value, 0, {
    get() {
      if (++reads > 72) {
        throw new Error('Probe exceeded bounded traversal');
      }
      return value;
    },
  });
  return value;
}

function oversizedArray() {
  const value = new Array(100001);
  Object.defineProperty(value, 0, {
    get() {
      throw new Error('Probe visited rejected vector');
    },
  });
  return value;
}

for (const [label, convert] of [
  ['canonical result', normalize],
  ['camelCase view', gramView],
  [
    'routed facade result',
    async (value) => {
      const client = new Anygram({
        adapters: [createAdapter('mtproto', { call: async () => value })],
      });
      return client.gramjs.invoke('help.getConfig');
    },
  ],
]) {
  it(`bounds ${label} root-array depth before unbounded recursion`, async () => {
    await assert.rejects(async () => convert(recursiveArray()), /depth limit/i);
  });
  it(`rejects excessive ${label} vectors before reading any element`, async () => {
    await assert.rejects(
      async () => convert(oversizedArray()),
      /vector length/i
    );
  });
}

it('normalizes repeated acyclic response arrays, primitives and actual vendor integers', () => {
  const vendor = new GramApi.InputPeerUser({ userId: 7n, accessHash: -17n });
  const bytes = Uint8Array.of(1, 2, 3);
  const shared = [vendor, null, false, bytes, -9n];
  const value = normalize([shared, shared]);
  assert.deepEqual(value[0], [
    { _: 'inputPeerUser', user_id: 7n, access_hash: -17n },
    null,
    false,
    bytes,
    -9n,
  ]);
  assert.deepEqual(value[0], value[1]);
  assert.notEqual(value[0], value[1]);
  assert.equal(value[0][3], bytes);
  const viewed = gramView([shared]);
  assert.equal(viewed[0][0].className, 'InputPeerUser');
  assert.equal(viewed[0][0].accessHash, -17n);
  assert.notEqual(viewed[0][3], bytes);
  assert.equal(normalize(undefined), undefined);
  assert.equal(normalize(7), 7);
});
