// Finite schema coverage and independent serialization comparison.
import { TlCodec } from '../src/tl.js';
import { gramRequest, requestOf } from '../src/requests.js';
import { Api } from 'teleproto/tl/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import assert from 'node:assert/strict';
const codec = new TlCodec();
const primitives = {
  int: 1,
  '#': 0,
  long: 7n,
  double: 0,
  string: '',
  bytes: new Uint8Array(),
  int128: new Uint8Array(16),
  int256: new Uint8Array(32),
  Bool: true,
  true: true,
};
const byType = new Map();
for (const entry of codec.constructors.values()) {
  const candidates = byType.get(entry.type) ?? [];
  candidates.push(entry);
  byType.set(entry.type, candidates);
}
function value(type, path = new Set()) {
  if (Object.hasOwn(primitives, type)) {
    return primitives[type];
  }
  if (/^(Vector|vector)</.test(type)) {
    return [];
  }
  if (['Object', 'X', '!X'].includes(type)) {
    return { _: 'help.getConfig' };
  }
  if (path.has(type) || path.size > 24) {
    throw new Error(`Recursive ${type}`);
  }
  const next = new Set([...path, type]);
  for (const candidate of byType.get(type) ??
    [codec.constructors.get(type)].filter(Boolean)) {
    try {
      return fixture(candidate, next);
    } catch {
      /* Try a nonrecursive constructor. */
    }
  }
  throw new Error(`No finite value for ${type}`);
}
function fixture(definition, path = new Set()) {
  return Object.fromEntries([
    ['_', definition.method ?? definition.predicate],
    ...definition.params
      .filter((field) => field.type !== '#' && !field.type.includes('?'))
      .map((field) => [field.name, value(field.type, path)]),
  ]);
}
export function runCorpus() {
  const counts = { methods: 0, constructors: 0, teleproto: 0, gramjs: 0 };
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
      // MTProto string fields carry binary data. Competitors' API registries
      // intentionally omit these handshake definitions.
      for (const [label, api] of [
        ['teleproto', Api],
        ['gramjs', GramApi],
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
    const path = value._.split('.');
    const name = path.pop();
    path.push(name[0].toUpperCase() + name.slice(1));
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
