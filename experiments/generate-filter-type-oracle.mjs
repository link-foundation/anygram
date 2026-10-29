import { readFile, writeFile } from 'node:fs/promises';

const root = new globalThis.URL('../', import.meta.url);
const source = await readFile(
  new globalThis.URL('examples/typed-filter-narrowing.ts', root),
  'utf8'
);
const fixture = source
  .replaceAll("from '../src/index.js'", "from 'grammy'")
  .replace(
    "import type { Telegram } from 'grammy';",
    "import type * as Telegram from '@grammyjs/types';"
  );
const output = `// Generated from the public migration fixture; run generate-filter-type-oracle.mjs.\n${fixture}`;
const file = new globalThis.URL(
  'experiments/typed-filter-sdk-fixture.ts',
  root
);
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== output) {
    throw new Error('Stale actual-SDK filter type fixture');
  }
} else {
  await writeFile(file, output);
}
