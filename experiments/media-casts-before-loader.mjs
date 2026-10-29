import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const target = new globalThis.URL('src/tl-resolution.js', root).href;

export function load(url, context, nextLoad) {
  if (url !== target) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync(
      'git',
      ['show', '67f631532971f4d38adb265948960d2a8432fa57:src/tl-resolution.js'],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
