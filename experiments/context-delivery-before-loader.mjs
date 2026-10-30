import { execFileSync } from 'node:child_process';

// Only replace owned context source; retain current assertions and actual SDKs.
// node --loader ./experiments/context-delivery-before-loader.mjs --test tests/bot-context-delivery.test.js
const root = new globalThis.URL('../', import.meta.url);
const target = new globalThis.URL('src/bot-context.js', root).href;
const revision = '0e55209c21a7011d481a31c32f965ce3bc5d5ecf';

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
