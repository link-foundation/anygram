import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const sources = new Map(
  [
    'client',
    'adapters',
    'gram-style',
    'media',
    'operations',
    'account-text',
    'requests',
  ].map((name) => [
    new globalThis.URL(`src/${name}.js`, root).href,
    `src/${name}.js`,
  ])
);

export function load(url, context, nextLoad) {
  const path = sources.get(url);
  return path
    ? {
        source: execFileSync(
          'git',
          ['show', `78df293f58eb148780f74570cee57bdebc23bfca:${path}`],
          { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
        ),
        format: 'module',
        shortCircuit: true,
      }
    : nextLoad(url, context);
}
