// Finite schema coverage and independent serialization comparison.
import { TlCodec } from '../src/tl.js';
import { gramClassName, gramRequest, requestOf } from '../src/requests.js';
import { Api } from 'teleproto/tl/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import assert from 'node:assert/strict';
import { createFixtureFactory } from './tl-fixtures.mjs';
const codec = new TlCodec();
const fixture = createFixtureFactory(codec);
export function runCorpus(additional = []) {
  const counts = {
    methods: 0,
    constructors: 0,
    teleproto: 0,
    gramjs: 0,
    ...Object.fromEntries(additional.map(([name]) => [name, 0])),
  };
  const failures = [];
  for (const definition of [
    ...codec.methods.values(),
    ...codec.constructors.values(),
  ]) {
    const name = definition.method ?? definition.predicate;
    try {
      if (['boolFalse', 'boolTrue'].includes(name)) {
        continue;
      }
      const input = fixture(definition);
      const bytes = codec.encode(input);
      assert.deepEqual(codec.encode(codec.decode(bytes)), bytes);
      counts[definition.method ? 'methods' : 'constructors']++;
      for (const [label, api] of [
        ['teleproto', Api],
        ['gramjs', GramApi],
        ...additional,
      ]) {
        if (!compatible(input, api)) {
          continue;
        }
        let oracle;
        try {
          oracle = gramRequest(api, requestOf(input));
        } catch {
          continue;
        }
        if (
          Number(oracle.CONSTRUCTOR_ID) >>> 0 !==
          Number(definition.id) >>> 0
        ) {
          continue;
        }
        assert.deepEqual(
          Buffer.from(bytes),
          oracle.getBytes(),
          `${label}: ${name}`
        );
        assert.deepEqual(
          codec.encode(oracle),
          bytes,
          `${label} request to native: ${name}`
        );
        counts[label]++;
      }
    } catch (error) {
      failures.push({ name, error: error.message });
    }
  }
  return { counts, failures };
}

function compatible(value, api) {
  if (!value || typeof value !== 'object' || value instanceof Uint8Array) {
    return true;
  }
  if (Array.isArray(value)) {
    return value.every((item) => compatible(item, api));
  }
  if (value._) {
    const path = gramClassName(value._).split('.');
    const constructor = path.reduce((scope, key) => scope?.[key], api);
    const definition =
      codec.methods.get(value._) ?? codec.constructors.get(value._);
    if (
      !constructor ||
      constructor.CONSTRUCTOR_ID >>> 0 !== Number(definition.id) >>> 0
    ) {
      return false;
    }
  }
  return Object.values(value).every((item) => compatible(item, api));
}

if (process.argv[1]?.endsWith('/schema-corpus.mjs')) {
  const result = runCorpus();
  console.log(JSON.stringify(result, null, 2));
  if (result.failures.length) {
    process.exitCode = 1;
  }
}
