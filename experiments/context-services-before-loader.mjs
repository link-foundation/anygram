import { execFileSync } from 'node:child_process';

// Preserve current tests and SDKs; pin context entry and shared administration.
// node --loader ./experiments/context-services-before-loader.mjs --test tests/bot-context-services.test.js tests/bot-context-admin.test.js
const root = new globalThis.URL('../', import.meta.url);
const targets = new Map(
  ['bot-context.js', 'bot-context-admin.js', 'bot-context-scope.js'].map(
    (name) => [new globalThis.URL(`src/${name}`, root).href, `src/${name}`]
  )
);
const revision = 'f346e4accfbab58cdb89525b74d141d09d924b93';

export function load(url, context, nextLoad) {
  if (!targets.has(url)) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync('git', ['show', `${revision}:${targets.get(url)}`], {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
    }),
    format: 'module',
    shortCircuit: true,
  };
}
