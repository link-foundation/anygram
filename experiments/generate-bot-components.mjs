import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

const root = new globalThis.URL('../', import.meta.url);
const data = await readFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/bot-api/component-facts.json',
    root
  )
);
if (
  createHash('sha256').update(data).digest('hex') !==
  'd2c5125ca906bc89e6ed83ae816b5643422da8b52a606bee27a59eb513d3db46'
) {
  throw new Error('Unreviewed public component facts');
}
const facts = JSON.parse(data);
const models = JSON.parse(
  await readFile(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/bot-api/model-facts.json',
      root
    )
  )
);
const quoted = (values) =>
  values.map((value) => JSON.stringify(value)).join(' | ');
const namespaces = [];
let count = 0;
for (const [model, entry] of Object.entries(facts.namespaces)) {
  const fields = new Set(
    models.models
      .find(({ name }) => name === model)
      .fields.map(({ name }) => name)
  );
  const keys = (values) => {
    for (const field of values) {
      if (!fields.has(field)) {
        throw new Error(`Unknown official component field: ${model}.${field}`);
      }
    }
    return quoted(values);
  };
  const raw =
    model === 'KeyboardButton' ? 'Exclude<KeyboardButton, string>' : model;
  const aliases = [];
  for (const [name, alias] of Object.entries(entry.aliases)) {
    const parts = [
      name === entry.base ? `Pick<${raw}, ${keys(entry.fields)}>` : entry.base,
    ];
    if (model === 'RichMessageButton' && name === entry.base) {
      parts[0] = "Pick<RichMessageButton, 'style'> & {text: RichLabel}";
    }
    if (alias.types !== undefined) {
      const officialTypes = models.models
        .find(({ name }) => name === model)
        .fields.find(({ name }) => name === 'type').values;
      const types =
        name === 'CommonMessageEntity'
          ? `Exclude<MessageEntity['type'], ${quoted(officialTypes.filter((type) => !alias.types.includes(type)))}>`
          : alias.types === null
            ? 'string'
            : quoted(alias.types);
      parts.push(`{type: ${types}}`);
    }
    if (alias.required.length) {
      parts.push(`Required<Pick<${raw}, ${keys(alias.required)}>>`);
    }
    if (alias.optional.length) {
      parts.push(`Pick<${raw}, ${keys(alias.optional)}>`);
    }
    if (name === 'DateTimeMessageEntity') {
      parts.push('{date_time_format: DateTimeFormat}');
    }
    if (name === 'RequestPollButton') {
      parts.push('{request_poll: {type?: "quiz" | "regular"}}');
    }
    if (model === 'RichMessageButton' && name === 'LoginUrlButton') {
      parts[1] = "{login_url: Omit<BotModels['LoginUrl'], 'bot_username'>}";
    }
    aliases.push(`export type ${name} = ${parts.join(' & ')};`);
    count++;
  }
  namespaces.push(
    `export type ${model} = BotModels['${model}'];\nexport declare namespace ${model} {${aliases.join('\n')}}`
  );
}
const richButtons = Object.keys(facts.namespaces.RichMessageButton.aliases)
  .filter((name) => name !== facts.namespaces.RichMessageButton.base)
  .map((name) => `RichMessageButton.${name}`)
  .join(' | ');
const output = await format(
  `// Public component names and owned official field projections; no SDK implementation.
// Regenerate: node experiments/generate-bot-components.mjs
import type { BotModels } from './bot-types/index.js';
type DateTimeFormat = 'r' | \`\${'w' | ''}\${'d' | 'D' | ''}\${'t' | 'T' | ''}\`;
interface RichLabelArray extends Array<RichLabel> {}
type RichLabelNode<T> = T extends string ? T
 : T extends Array<unknown> ? RichLabelArray
 : T extends {type: 'button'} ? Omit<T, 'button'> & {button: ${richButtons}}
 : T extends {type: 'date_time'} ? Omit<T, 'text' | 'date_time_format'> & {text: RichLabel; date_time_format: DateTimeFormat}
 : T extends {text: unknown} ? Omit<T, 'text'> & {text: RichLabel}
 : T;
type RichLabel = RichLabelNode<BotModels['RichText']>;
${namespaces.join('\n')}
`,
  { parser: 'typescript', singleQuote: true, trailingComma: 'es5' }
);
const file = new globalThis.URL('src/bot-component-types.d.ts', root);
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== output) {
    throw new Error('Stale Bot API component subtypes');
  }
} else {
  await writeFile(file, output);
}
console.log(`Verified ${count} public entity and button subtype names`);
