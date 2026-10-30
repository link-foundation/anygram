import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { loadTerminalSource } from '../load-terminal-source.mjs';
import { terminalLogger } from './log-destination.mjs';

const [mode, root] = process.argv.slice(2);
if (!root || !['text', 'visual'].includes(mode)) {
  throw new Error('Fatal-exit fixture requires its bounded mode and directory');
}
loadTerminalSource(
  mode,
  {
    config() {},
    pino: terminalLogger(root),
    process,
    mkdirSync: (directory, options) =>
      mkdirSync(join(root, directory), options),
    Bot: class {
      constructor() {
        throw new Error('Invalid configuration constructed a bot');
      }
    },
  },
  { initialization: true, startup: true }
);
