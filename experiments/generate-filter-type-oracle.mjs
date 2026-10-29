import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

const root = new globalThis.URL('../', import.meta.url);
const options = JSON.parse(
  await readFile(new globalThis.URL('.prettierrc', root), 'utf8')
);
const fixtures = [
  ['typed-filter-narrowing.ts', 'typed-filter-sdk-fixture.ts', 'grammy'],
  ['typed-telegraf-filters.ts', 'typed-telegraf-sdk-fixture.ts', 'telegraf'],
];
for (const [sourceName, targetName, sdk] of fixtures) {
  const source = await readFile(
    new globalThis.URL(`examples/${sourceName}`, root),
    'utf8'
  );
  const fixture = source
    .replaceAll("from '../src/index.js'", `from '${sdk}'`)
    .replace('TelegrafComposer as Composer', 'Composer')
    .replace('TelegrafContext as Context', 'Context')
    .replace(
      "import type { BotUpdate } from 'telegraf';",
      "import type { Update as BotUpdate } from 'telegraf/types';"
    )
    .replace(
      "import type { Telegram } from 'grammy';",
      "import type * as Telegram from '@grammyjs/types';"
    );
  const output = await format(
    `// Generated from the public migration fixture; run generate-filter-type-oracle.mjs.\n${fixture}`,
    { ...options, parser: 'typescript' }
  );
  const file = new globalThis.URL(`experiments/${targetName}`, root);
  if (process.argv.includes('--check')) {
    if ((await readFile(file, 'utf8')) !== output) {
      throw new Error('Stale actual-SDK filter type fixture');
    }
  } else {
    await writeFile(file, output);
  }
}
