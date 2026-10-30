import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const paths = [
  'account-message',
  'operations',
  'gram-style',
  'client',
  'adapters',
  'factory',
];
const sources = new Map(
  paths.map((name) => [
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
          ['show', `2e0eecc164df94c0af5a2c0109fba83e927916fb:${path}`],
          { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
        ),
        format: 'module',
        shortCircuit: true,
      }
    : nextLoad(url, context);
}
