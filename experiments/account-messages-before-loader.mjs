import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const targets = new Set(
  ['src/gram-style.js', 'src/client.js', 'src/operations.js'].map(
    (file) => new globalThis.URL(file, root).href
  )
);

export function load(url, context, nextLoad) {
  if (!targets.has(url)) {
    return nextLoad(url, context);
  }
  const path = url.slice(root.href.length);
  return {
    source: execFileSync(
      'git',
      ['show', `8a37c45d45edeea94a62ed0afbaa1f4677fea151:${path}`],
      { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
