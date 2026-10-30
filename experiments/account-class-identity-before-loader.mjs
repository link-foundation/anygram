import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const sources = new Map(
  ['api', 'gram-style'].map((name) => [
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
          ['show', `801192fb3cea2fe4eca9c80c97ea12af9ecd6621:${path}`],
          { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
        ),
        format: 'module',
        shortCircuit: true,
      }
    : nextLoad(url, context);
}
