import { execFileSync } from 'node:child_process';

// Retain current assertions and actual SDKs; replace only the preceding context.
// node --loader ./experiments/context-admin-before-loader.mjs --test tests/bot-context-admin.test.js
const root = new globalThis.URL('../', import.meta.url);
const target = new globalThis.URL('src/bot-context.js', root).href;
const revision = 'd14764fd5ebccd2ae7b00bfe4c2b55b09f997a5c';

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
