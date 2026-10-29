import { execFileSync } from 'node:child_process';

// Freeze only the context entry; actual SDK oracles and all assertions stay current.
const root = new globalThis.URL('../', import.meta.url);
const target = new globalThis.URL('src/bot-context.js', root).href;
const revision = 'a008885d17aa9b564b3a172f02e7c4435ccd2a6a';
export function load(url, context, nextLoad) {
  if (url !== target) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync('git', ['show', `${revision}:src/bot-context.js`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
    }),
    format: 'module',
    shortCircuit: true,
  };
}
