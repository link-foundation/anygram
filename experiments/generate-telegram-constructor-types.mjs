import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
const root = new globalThis.URL('../', import.meta.url);
const facts = JSON.parse(
  await readFile(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/bot-api/model-facts.json',
      root
    )
  )
);
const names = [
  'BotModels',
  'RichTextArray',
  ...facts.models.map(({ name }) => name),
];
const aliases = new Map([
  ...['Message', 'Chat', 'ChatFullInfo', 'Update'].map((name) => [
    name,
    'Messages',
  ]),
  ...[
    'MessageEntity',
    'KeyboardButton',
    'InlineKeyboardButton',
    'RichMessageButton',
  ].map((name) => [name, 'Components']),
]);
if (new Set(names).size !== 402) {
  throw new Error('Review the complete Telegram model namespace inventory');
}
const source = `// Generated model aliases retain existing nested namespaces beside the constructor.
// Regenerate: node experiments/generate-telegram-constructor-types.mjs
// Qualified import aliases require a regular declaration import, including type aliases.
import * as Models from './bot-types/index.js';
import * as Messages from './bot-message-types.js';
import * as Components from './bot-component-types.js';
import type { TelegrafTelegramApi, TelegrafTelegramConstructorOptions } from './telegraf-server-types.js';
import type { WebhookResponse } from './index.js';
export declare class Telegram {
 constructor(token: string, options?: TelegrafTelegramConstructorOptions, response?: WebhookResponse);
}
export interface Telegram extends TelegrafTelegramApi {}
export declare namespace Telegram {
${names.map((name) => `export import ${name} = ${aliases.get(name) ?? 'Models'}.${name};`).join('\n')}
}
`;
const output = await format(source, {
  parser: 'typescript',
  singleQuote: true,
  trailingComma: 'es5',
});
const file = new globalThis.URL('src/telegraf-api.d.ts', root);
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== output) {
    throw new Error('Stale standalone Telegram declarations or model aliases');
  }
} else {
  await writeFile(file, output);
}
console.log(`Verified Telegram construction and ${names.length} model aliases`);
