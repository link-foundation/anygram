import { execFileSync } from 'node:child_process';
const root = new globalThis.URL('../', import.meta.url);
// Freeze the complete runner before nested transport settings and scoped views.
export function load(url, context, nextLoad) {
  const path = [
    'src/bot.js',
    'src/bot-api.js',
    'src/bot-webhook-reply.js',
    'src/polling.js',
  ].find((entry) => url === new globalThis.URL(entry, root).href);
  if (!path) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync(
      'git',
      ['show', `8874fdbc9e59261c337e3482116e7dfadd676c31:${path}`],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
