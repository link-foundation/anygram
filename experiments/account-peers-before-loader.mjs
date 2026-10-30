import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const paths = [
  'src/account-message.js',
  'src/operations.js',
  'src/gram-style.js',
];
const sources = new Map(
  paths.map((path) => [new globalThis.URL(path, root).href, path])
);
export function load(url, context, nextLoad) {
  const path = sources.get(url);
  if (!path) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync(
      'git',
      ['show', `1d5a564b133afa3e33ac22200f3caa29a219fa0a:${path}`],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 128 * 1024,
      }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
