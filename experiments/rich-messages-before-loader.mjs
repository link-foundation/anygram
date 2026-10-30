import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const paths = [
  'index.js',
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
          ['show', `85aff538bf61684423c831ab17b8c08bdfbac5e1:${path}`],
          { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
        ),
        format: 'module',
        shortCircuit: true,
      }
    : nextLoad(url, context);
}
