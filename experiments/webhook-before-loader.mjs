import { execFileSync } from 'node:child_process';

// Freeze only the runner that discarded the response; retain the exact new tests.
const root = new globalThis.URL('../', import.meta.url);
const target = new globalThis.URL('src/bot.js', root).href;
export function load(url, context, nextLoad) {
  if (url !== target) {
    return nextLoad(url, context);
  }
  return {
    source: execFileSync(
      'git',
      ['show', 'd4c76ce80b21943390dd4f762f247e0301194069:src/bot.js'],
      { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 }
    ),
    format: 'module',
    shortCircuit: true,
  };
}
