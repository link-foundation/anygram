import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
const root = new globalThis.URL('../', import.meta.url);
const options = JSON.parse(
  await readFile(new globalThis.URL('.prettierrc', root))
);
for (const [sourceName, targetName, sdk, namespace] of [
  [
    'typed-telegraf-agents.ts',
    'typed-telegraf-agents-fixture.ts',
    'telegraf',
    'telegraf/types',
  ],
  [
    'typed-telegram-constructor.ts',
    'typed-telegram-constructor-fixture.ts',
    'telegraf',
    'telegraf/types',
  ],
  [
    'typed-telegraf-options.ts',
    'typed-telegraf-options-fixture.ts',
    'telegraf',
    'telegraf/types',
  ],
  [
    'typed-telegraf-lifecycle.ts',
    'typed-telegraf-lifecycle-fixture.ts',
    'telegraf',
    'telegraf/types',
  ],
  [
    'typed-grammy-frameworks.ts',
    'typed-grammy-frameworks-fixture.ts',
    'grammy',
    '@grammyjs/types',
  ],
  [
    'typed-grammy-webhook.ts',
    'typed-grammy-webhook-fixture.ts',
    'grammy',
    '@grammyjs/types',
  ],
  [
    'typed-telegraf-webhook.ts',
    'typed-telegraf-webhook-fixture.ts',
    'telegraf',
    'telegraf/types',
  ],
  [
    'typed-grammy-components.ts',
    'typed-grammy-components-fixture.ts',
    'grammy',
    '@grammyjs/types',
  ],
  [
    'typed-telegraf-components.ts',
    'typed-telegraf-components-fixture.ts',
    'telegraf',
    'telegraf/types',
  ],
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
  [
    'typed-grammy-context-results.ts',
    'typed-grammy-context-fixture.ts',
    'grammy',
    '@grammyjs/types',
  ],
  [
    'typed-telegraf-context-results.ts',
    'typed-telegraf-context-fixture.ts',
    'telegraf',
    'telegraf/types',
  ],
  [
    'typed-grammy-message-subtypes.ts',
    'typed-grammy-subtypes-fixture.ts',
    'grammy',
    '@grammyjs/types',
  ],
  [
    'typed-telegraf-message-subtypes.ts',
    'typed-telegraf-subtypes-fixture.ts',
    'telegraf',
    'telegraf/types',
  ],
  [
    'typed-grammy-delivery-arguments.ts',
    'typed-grammy-delivery-fixture.ts',
    'grammy',
    '@grammyjs/types',
  ],
  [
    'typed-telegraf-delivery-arguments.ts',
    'typed-telegraf-delivery-fixture.ts',
    'telegraf',
    'telegraf/types',
  ],
]) {
  const source = (
    await readFile(new globalThis.URL(`examples/${sourceName}`, root), 'utf8')
  )
    .replaceAll("from '../src/index.js'", `from '${sdk}'`)
    .replace(
      "import { TelegrafContext as SDKContext } from 'telegraf';",
      "import { Context as SDKContext } from 'telegraf';"
    )
    .replace(
      "import type { TelegrafContext as Context } from 'telegraf';",
      "import type { Context } from 'telegraf';"
    )
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
