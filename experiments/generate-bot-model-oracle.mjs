import { readFile, readdir, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

const root = new globalThis.URL('../', import.meta.url);
const facts = JSON.parse(
  await readFile(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/bot-api/model-facts.json',
      root
    ),
    'utf8'
  )
);
const directory = new globalThis.URL('node_modules/@grammyjs/types/', root);
const declarations = (
  await Promise.all(
    (await readdir(directory))
      .filter((file) => file.endsWith('.d.ts'))
      .map((file) => readFile(new globalThis.URL(file, directory), 'utf8'))
  )
).join('\n');
const generics = new Set(
  [...declarations.matchAll(/export (?:interface|type) (\w+)</g)].map(
    (match) => match[1]
  )
);
const models = facts.models.filter((model) => model.name !== 'InputFile');
// These definitions recursively contain Message.is_topic_message. The pinned
// SDK accepts false, while the official wire table specifies optional True.
const messageFlag = new Set([
  'Update',
  'ChatFullInfo',
  'Message',
  'MaybeInaccessibleMessage',
  'PollOptionAdded',
  'PollOptionDeleted',
  'ChecklistTasksDone',
  'ChecklistTasksAdded',
  'SuggestedPostApproved',
  'SuggestedPostApprovalFailed',
  'SuggestedPostDeclined',
  'SuggestedPostPaid',
  'SuggestedPostRefunded',
  'GiveawayCompleted',
  'CallbackQuery',
]);
const broaderSdk = new Set([...messageFlag, 'WebhookInfo', 'RefundedPayment']);
const diagnostics = process.argv.includes('--diagnostics');
const source = `import type * as Original from '@grammyjs/types';
import type { Telegram } from '../src/index.js';
${
  diagnostics
    ? models
        .map(
          ({ name }) =>
            `declare const original${name}: Original.${name}${generics.has(name) ? '<string>' : ''};\nexport const owned${name}: Telegram.${name} = original${name};`
        )
        .join('\n')
    : `
type Assert<T extends true> = T;
type Accepts<Expected, Actual> = [Actual] extends [Expected] ? true : false;
type Equal<A, B> = [A, B] extends [B, A] ? true : false;
interface OriginalModels {
${models
  .map(
    ({ name }) =>
      `${name}: Original.${name}${generics.has(name) ? '<string>' : ''};`
  )
  .join('\n')}
}
type BroaderSdk = ${[...broaderSdk].map((name) => JSON.stringify(name)).join(' | ')};
type Differences = {
  [K in keyof OriginalModels]: Equal<Accepts<Telegram.BotModels[K], OriginalModels[K]>, K extends BroaderSdk ? false : true> extends true ? never : K
}[keyof OriginalModels];
export interface BotModelOracle {
  inventory: Assert<Equal<keyof OriginalModels, Exclude<keyof Telegram.BotModels, 'InputFile'>>>;
  assignments: Assert<Equal<Differences, never>>;
}
export interface KnownSdkPrecisionDifferences {
  originalTopic: Assert<Equal<Original.Message['is_topic_message'], boolean | undefined>>;
  wireTopic: Assert<Equal<Telegram.Message['is_topic_message'], true | undefined>>;
  originalWebhook: Assert<Equal<Original.WebhookInfo['url'], string | undefined>>;
  wireWebhook: Assert<Equal<Telegram.WebhookInfo['url'], string>>;
  originalRefund: Assert<Equal<Original.RefundedPayment['currency'], string>>;
  wireRefund: Assert<Equal<Telegram.RefundedPayment['currency'], 'XTR'>>;
}`
}`;
const file = new globalThis.URL(
  `experiments/typed-bot-model-${diagnostics ? 'diagnostics' : 'oracle'}.ts`,
  root
);
const output = await format(source, {
  parser: 'typescript',
  singleQuote: true,
  trailingComma: 'es5',
});
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== output) {
    throw new Error('Stale actual-SDK Bot API model oracle');
  }
} else {
  await writeFile(file, output);
}
console.log(
  `Verified ${models.length} SDK model comparisons, including ${broaderSdk.size} explicit precision differences`
);
