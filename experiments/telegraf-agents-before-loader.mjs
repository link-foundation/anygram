import { execFileSync } from 'node:child_process';
const root = new globalThis.URL('../', import.meta.url);
// Freeze all affected runner/upload code before agent and constructor support.
export function load(url, context, nextLoad) {
  const path = [
    'src/index.js',
    'src/telegraf-api.js',
    'src/bot-api.js',
    'src/bot-webhook-reply.js',
    'src/bot-api-upload.js',
    'src/requests.js',
  ].find((entry) => url === new globalThis.URL(entry, root).href);
  if (!path) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync(
      'git',
      ['show', `ce24156ce1d785a995036d1557fae97962df21d6:${path}`],
      {
        cwd: root,
        encoding: 'utf8',
        maxBuffer: 64 * 1024,
      }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
