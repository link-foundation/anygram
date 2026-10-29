import { execFileSync } from 'node:child_process';

// Freeze the preceding public entry and its composer consumers; retain all SDKs/assertions.
const root = new globalThis.URL('../', import.meta.url);
const revision = '8835d73871b4ebd1076b653b5286755890f67bb8';
const frozen = new Map(
  ['index', 'composer', 'bot', 'scenes'].map((name) => {
    const path = `src/${name}.js`;
    return [new globalThis.URL(path, root).href, path];
  })
);
export function load(url, context, nextLoad) {
  const path = frozen.get(url);
  if (!path) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync('git', ['show', `${revision}:${path}`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
    }),
    format: 'module',
    shortCircuit: true,
  };
}
