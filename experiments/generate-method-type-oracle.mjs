import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
const root = new globalThis.URL('../', import.meta.url);
const options = JSON.parse(
  await readFile(new globalThis.URL('.prettierrc', root))
);
for (const [sourceName, targetName, sdk, namespace] of [
  [
    'typed-bot-api-methods.ts',
    'typed-grammy-method-fixture.ts',
    'grammy',
    '@grammyjs/types',
  ],
  [
    'typed-telegraf-api-methods.ts',
    'typed-telegraf-method-fixture.ts',
    'telegraf',
    'telegraf/types',
  ],
]) {
  const source = (
    await readFile(new globalThis.URL(`examples/${sourceName}`, root), 'utf8')
  )
    .replaceAll("from '../src/index.js'", `from '${sdk}'`)
    .replace(
      `import type { Telegram } from '${sdk}';`,
      `import type * as Telegram from '${namespace}';`
    )
    .replaceAll(
      sdk === 'telegraf' ? 'Telegram.ChatFullInfo' : 'NO_MODEL_RENAME',
      'Telegram.ChatFromGetChat'
    );
  const output = await format(
    `// Generated portable request/result fixture; run generate-method-type-oracle.mjs.\n${source}`,
    { ...options, parser: 'typescript' }
  );
  const file = new globalThis.URL(`experiments/${targetName}`, root);
  if (process.argv.includes('--check')) {
    if ((await readFile(file, 'utf8')) !== output) {
      throw new Error(`Stale actual-SDK method type fixture: ${targetName}`);
    }
  } else {
    await writeFile(file, output);
  }
}
