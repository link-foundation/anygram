import { execFileSync } from 'node:child_process';
const root = new globalThis.URL('../', import.meta.url);
// Freeze the complete runner before Telegraf callback, context and server support.
export function load(url, context, nextLoad) {
  const path = ['src/bot.js', 'src/bot-context.js'].find(
    (entry) => url === new globalThis.URL(entry, root).href
  );
  if (!path) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync(
      'git',
      ['show', `197d5a1baedf3f10c24e6005a08fad79518e68ee:${path}`],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
