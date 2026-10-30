// Minimal finite fixtures shared by the cloud and end-to-end schema corpora.
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

export function createFixtureFactory(codec) {
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
  return fixture;
}
