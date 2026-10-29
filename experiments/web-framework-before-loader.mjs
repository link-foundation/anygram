import { execFileSync } from 'node:child_process';

// Keep current HTTP/core tests while freezing response selection before the fix.
const root = new globalThis.URL('../', import.meta.url);
const target = new globalThis.URL('src/bot-webhook-reply.js', root).href;
export function load(url, context, nextLoad) {
  if (url !== target) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync(
      'git',
      [
        'show',
        '88f3c2e4a501169cecf4a6ad8476c942104040dc:src/bot-webhook-reply.js',
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
