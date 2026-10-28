import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { runCorpus } from '../experiments/schema-corpus.mjs';
it('round trips the complete schema and matches actual pinned client serializers', () => {
  const result = runCorpus();
  assert.deepEqual(result.failures, []);
  assert.equal(result.counts.methods, 869);
  assert.equal(result.counts.constructors, 1758);
  assert.equal(result.counts.teleproto, 2580);
  assert.equal(result.counts.gramjs, 1888);
});
