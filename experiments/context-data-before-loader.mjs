import { execFileSync } from 'node:child_process';

// Reproduce the complete context regression suite against the preceding source:
// node --loader ./experiments/context-data-before-loader.mjs --test tests/bot-context-data.test.js
// Only the owned context module is substituted; SDKs and assertions stay intact.
const root = new globalThis.URL('../', import.meta.url);
const target = new globalThis.URL('src/bot-context.js', root).href;
const revision = '5b6b1a8bb1b4d284b97efcbc75a38c6d6bf0dee8';

export function load(url, context, nextLoad) {
  if (url !== target) {
    return nextLoad(url, context);
  }
  const source = execFileSync(
    'git',
    ['show', `${revision}:src/bot-context.js`],
    {
      cwd: root,
      encoding: 'utf8',
      maxBuffer: 64 * 1024,
    }
  );
  return { source, format: 'module', shortCircuit: true };
}
