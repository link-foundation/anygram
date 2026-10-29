import { execFileSync } from 'node:child_process';

// Retain actual SDKs and complete assertions; replace only the context entry.
// node --loader ./experiments/context-actions-before-loader.mjs --test tests/bot-context-message-actions.test.js
const root = new globalThis.URL('../', import.meta.url);
const target = new globalThis.URL('src/bot-context.js', root).href;
const revision = 'd76b83cbd5495042405a4951c890317032ceecd7';

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
