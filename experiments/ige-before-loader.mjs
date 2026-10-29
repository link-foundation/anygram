import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const target = new globalThis.URL('src/crypto.js', root).href;

export function load(url, context, nextLoad) {
  if (url !== target) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync(
      'git',
      ['show', 'd949e9b9e06bd7b3d63907c164ab87f9bbcc8de3:src/crypto.js'],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
