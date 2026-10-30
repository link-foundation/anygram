import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const paths = new Map(
  ['account-html', 'rich-tree'].map((name) => [
    new globalThis.URL(`src/${name}.js`, root).href,
    `src/${name}.js`,
  ])
);
export function load(url, context, nextLoad) {
  const path = paths.get(url);
  return path
    ? {
        source: execFileSync(
          'git',
          ['show', `f315c14e5e14256b8823537af2e163dfa5296c1c:${path}`],
          { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
        ),
        format: 'module',
        shortCircuit: true,
      }
    : nextLoad(url, context);
}
