import { mkdirSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { migrateTerminalSource } from '../examples/terminal-migration.js';
import { readTerminalSource } from './load-terminal-source.mjs';

// Emit a complete, reviewable patch; executing this script never opens a PTY.
const root = 'ci-logs/terminal-migration';
mkdirSync(`${root}/original`, { recursive: true });
mkdirSync(`${root}/migrated`, { recursive: true });
let patch = '';
for (const mode of ['text', 'visual']) {
  const file = `${mode}-bot.source`;
  const source = readTerminalSource(`src/${mode}-bot.js`);
  writeFileSync(`${root}/original/${file}`, source);
  writeFileSync(`${root}/migrated/${file}`, migrateTerminalSource(source));
  const result = spawnSync(
    'git',
    [
      'diff',
      '--no-index',
      '--no-color',
      '--no-ext-diff',
      '--',
      `${root}/original/${file}`,
      `${root}/migrated/${file}`,
    ],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
  if (result.error || result.status !== 1) {
    throw (
      result.error ??
      new Error(`Unable to emit terminal migration diff: ${result.stderr}`)
    );
  }
  patch += result.stdout
    .replaceAll(`a/${root}/original/`, 'a/src/')
    .replaceAll(`b/${root}/migrated/`, 'b/src/')
    .replaceAll(file, `${mode}-bot.js`);
}
writeFileSync('docs/case-studies/issue-1/terminal-migration.patch', patch);
console.log('Emitted both complete terminal source patches');
