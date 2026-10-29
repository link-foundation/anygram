import {
  readTerminalSource,
  loadVirtualTerminal,
} from '../load-terminal-source.mjs';

const path = process.argv[2];
if (!/^src\/tests\/(?:debug\/)?[a-z-]+\.js$/.test(path ?? '')) {
  throw new TypeError('Expected a pinned terminal test path');
}
let source = readTerminalSource(path);
const statement = "import VirtualTerminal from '../virtual-terminal.js';";
if (source.split(statement).length !== 2) {
  throw new Error('Pinned terminal dependency boundary changed');
}
// The debug directory's original relative imports are broken. Inject the same
// hash-verified emulator explicitly; leave every test/diagnostic body intact.
source = source.replace(/^#![^\n]*\n/, '').replace(statement, '');
source = source.replace(/\b(main|runAllTests)\(\);\s*$/, 'return $1();');
await new Function('VirtualTerminal', source)(loadVirtualTerminal());
console.log('ANYGRAM_PINNED_TERMINAL_SCRIPT_COMPLETE');
