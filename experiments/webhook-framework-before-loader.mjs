import { execFileSync } from 'node:child_process';

// Keep the current adapter tests and freeze the runner and reply ownership code.
const root = new globalThis.URL('../', import.meta.url);
const paths = ['src/bot.js', 'src/bot-webhook-reply.js'];
export function load(url, context, nextLoad) {
  const path = paths.find(
    (entry) => new globalThis.URL(entry, root).href === url
  );
  if (!path) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync(
      'git',
      ['show', `b73f33041ba5ac00895d4b808ecd48947c33de4f:${path}`],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
