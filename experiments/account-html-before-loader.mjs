import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const sources = new Map(
  ['index', 'account-text'].map((name) => [
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
          ['show', `2c40acd5ade91284195e2363c41d28f22e96de6d:${path}`],
          { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
        ),
        format: 'module',
        shortCircuit: true,
      }
    : nextLoad(url, context);
}
