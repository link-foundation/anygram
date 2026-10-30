import { execFileSync } from 'node:child_process';

const root = new globalThis.URL('../', import.meta.url);
const target = new globalThis.URL('src/account-message.js', root).href;

export function load(url, context, nextLoad) {
  if (url !== target) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync(
      'git',
      [
        'show',
        '5c4de84dd8440c39e36e8954d5ab0630a9360148:src/account-message.js',
      ],
      { cwd: root, encoding: 'utf8', maxBuffer: 128 * 1024 }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
