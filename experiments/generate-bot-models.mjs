import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { factorModelFields } from './bot-model-shapes.mjs';
import { factType } from './bot-fact-types.mjs';

const root = new globalThis.URL('../', import.meta.url);
const archive = new globalThis.URL(
  'docs/case-studies/issue-1/data/bot-api/',
  root
);
const data = await readFile(new globalThis.URL('model-facts.json', archive));
const facts = JSON.parse(data);
const hash = (value) => createHash('sha256').update(value).digest('hex');
if (
  hash(data) !==
    'e4b537a1ec37fd75889d1dc7030161604f9456b8ea6eea6a988692cab0d4111f' ||
  hash(await readFile(new globalThis.URL('api-2026-10-29.html', archive))) !==
    facts.sha256
) {
  throw new Error('Unreviewed official Bot API model facts');
}
const names = new Set(facts.models.map((model) => model.name));
const fieldType = (type) =>
  factType(type, names, { richText: "import('./index.js').RichTextArray" });
function property(field) {
  let type = field.values
    ? field.values.map((value) => JSON.stringify(value)).join(' | ')
    : fieldType(field.type);
  if (field.upload) {
    type += ' | BotModels["InputFile"]';
  }
  return `${field.name}${field.optional ? '?' : ''}: ${type};`;
}
const { indexed, shared } = factorModelFields(facts.models, property);
function objectShape(node) {
  const parts = node.fields.size
    ? [`{${[...node.fields.values()].join('\n')}}`]
    : [];
  parts.push(...node.references.map((name) => `SharedFields['${name}']`));
  return parts.join(' & ');
}
function shape(model) {
  if (model.name === 'InputFile') {
    return "import('../index.js').InputFile";
  }
  const union = [
    ...(model.fields.length ? [objectShape(indexed.get(model.name))] : []),
    ...model.alternatives.map(fieldType),
    ...model.members.map(fieldType),
  ];
  return union.join(' | ') || 'object';
}
const directory = new globalThis.URL('src/bot-types/', root);
const files = new Map();
const groups = [];
files.set(
  'shared.d.ts',
  `import type { BotModels } from './index.js';\nexport interface SharedFields {${shared.map((node) => `${node.name}: ${objectShape(node)};`).join('\n')}}`
);
for (let offset = 0; offset < facts.models.length; offset += 50) {
  const name = `Models${offset / 50}`;
  groups.push(name);
  files.set(
    `${name.toLowerCase()}.d.ts`,
    `import type { BotModels } from './index.js';\nimport type { SharedFields } from './shared.js';\nexport interface ${name} {\n${facts.models
      .slice(offset, offset + 50)
      .map((model) => `${model.name}: ${shape(model)};`)
      .join('\n')}\n}`
  );
}
files.set(
  'index.d.ts',
  `${groups
    .map((name) => `import type { ${name} } from './${name.toLowerCase()}.js';`)
    .join(
      '\n'
    )}\nexport interface BotModels extends ${groups.join(', ')} {}\nexport interface RichTextArray extends Array<RichText> {}\n${facts.models
    .map((model) =>
      ['Message', 'Chat', 'ChatFullInfo', 'Update'].includes(model.name)
        ? `export type { ${model.name} } from '../bot-message-types.js';`
        : `export type ${model.name} = BotModels['${model.name}'];`
    )
    .join('\n')}`
);
await mkdir(directory, { recursive: true });
for (const [file, source] of files) {
  const output = await format(
    `// Official Bot API field facts, independently generated.\n// Regenerate: node experiments/generate-bot-models.mjs\n${source}`,
    { parser: 'typescript', singleQuote: true, trailingComma: 'es5' }
  );
  const path = new globalThis.URL(file, directory);
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')) !== output) {
      throw new Error(`Stale Bot API model declaration: ${file}`);
    }
  } else {
    await writeFile(path, output);
  }
}
const actual = (await readdir(directory)).sort();
if (JSON.stringify(actual) !== JSON.stringify([...files.keys()].sort())) {
  throw new Error('Unexpected Bot API model declaration file');
}
console.log(
  `Verified ${facts.models.length} official models and ${facts.models.reduce((sum, model) => sum + model.fields.length, 0)} fields in ${files.size} files`
);
