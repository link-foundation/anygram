import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const sources = new Map(
  [
    'client',
    'account-text',
    'gram-style',
    'account-message',
    'account-buttons',
    'media-text',
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
          ['show', `86d7685503f19e647bd13e9a880f99b1d0e39c88:${path}`],
          { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
        ),
        format: 'module',
        shortCircuit: true,
      }
    : nextLoad(url, context);
}
