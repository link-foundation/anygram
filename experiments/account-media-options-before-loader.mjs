import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const sources = new Map(
  ['media', 'tl-media', 'file-source'].map((name) => [
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
          ['show', `5ad1af7756479e63ab6162bacb9ee6de45d1e0ad:${path}`],
          { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
        ),
        format: 'module',
        shortCircuit: true,
      }
    : nextLoad(url, context);
}
