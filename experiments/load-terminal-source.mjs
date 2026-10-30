import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { migrateTerminalSource } from '../examples/terminal-migration.js';

const root = new globalThis.URL(
  '../docs/case-studies/issue-1/data/',
  import.meta.url
);
const manifest = JSON.parse(
  readFileSync(
    new globalThis.URL('terminal-source-manifest.json', root),
    'utf8'
  )
);

export function readTerminalSource(path) {
  const entry = manifest.sources.find(
    (item) => item.file === `terminal-source/${path}`
  );
  if (!entry || entry.bytes > 128 * 1024) {
    throw new RangeError('Unknown or oversized terminal fixture');
  }
  const bytes = readFileSync(new globalThis.URL(entry.file, root));
  if (
    bytes.length !== entry.bytes ||
    createHash('sha256').update(bytes).digest('hex') !== entry.sha256
  ) {
    throw new Error(
      'Pinned terminal source differs from its immutable manifest'
    );
  }
  return bytes.toString('utf8');
}

export function loadVirtualTerminal() {
  const source = readTerminalSource('src/virtual-terminal.js');
  return new Function(
    `${source.replace('export default VirtualTerminal;', '')}\nreturn VirtualTerminal;`
  )();
}

/** Verify immutable source, then execute selected startup and handler boundaries. */
export function loadTerminalSource(
  mode,
  dependencies,
  { migrated = true, startup = false, initialization = false } = {}
) {
  if (!['text', 'visual'].includes(mode)) {
    throw new TypeError('Unknown terminal mode');
  }
  let source = readTerminalSource(`src/${mode}-bot.js`);
  if (migrated) {
    source = migrateTerminalSource(source);
  }
  const begin = initialization
    ? source.indexOf('config();')
    : source.indexOf('const bot = new Bot(');
  const end = source.indexOf('// Start the bot');
  if (begin < 0 || end <= begin) {
    throw new Error('Pinned terminal application boundaries changed');
  }
  const body = source.slice(begin, startup ? undefined : end);
  if (initialization) {
    dependencies = { ...dependencies };
    delete dependencies.logger;
    delete dependencies.logStream;
  }
  return new Function(
    ...Object.keys(dependencies),
    `'use strict';\n${body}\nreturn { bot, userSessions, parseCommandInput, formatTerminalOutput${initialization ? ', logger, logStream' : ''}${startup ? ", polling: typeof polling === 'undefined' ? null : polling" : ''} };`
  )(...Object.values(dependencies));
}
