import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const paths = [
  'account-message.js',
  'operations.js',
  'gram-style.js',
  'client.js',
  'adapters.js',
];
const sources = new Map(
  paths.map((path) => [
    new globalThis.URL(`src/${path}`, root).href,
    `src/${path}`,
  ])
);
export function load(url, context, nextLoad) {
  const path = sources.get(url);
  return path
    ? {
        source: execFileSync(
          'git',
          ['show', `8da6cd7d11d0229bf02a3c3ba3372aebc465a544:${path}`],
          { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
        ),
        format: 'module',
        shortCircuit: true,
      }
    : nextLoad(url, context);
}
