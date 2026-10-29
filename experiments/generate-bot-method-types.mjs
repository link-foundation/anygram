import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { format } from 'prettier';
import { factType } from './bot-fact-types.mjs';
import { factorModelFields } from './bot-model-shapes.mjs';
import { referenceModelFields } from './bot-method-shapes.mjs';

const root = new globalThis.URL('../', import.meta.url);
const archive = new globalThis.URL(
  'docs/case-studies/issue-1/data/bot-api/',
  root
);
const data = await readFile(new globalThis.URL('method-facts.json', archive));
const facts = JSON.parse(data);
const hash = (value) => createHash('sha256').update(value).digest('hex');
if (
  hash(data) !==
    'd5959672c6dda9b316f9cf2d6e7993f6080f48b40e8f189f93264bcea316c6ad' ||
  hash(await readFile(new globalThis.URL('api-2026-10-29.html', archive))) !==
    facts.sha256
) {
  throw new Error('Unreviewed official Bot API method facts');
}
const models = JSON.parse(
  await readFile(new globalThis.URL('model-facts.json', archive))
);
const names = new Set(models.models.map((model) => model.name));
function property(field) {
  let type = field.values
    ? field.values.map((value) => JSON.stringify(value)).join(' | ')
    : factType(field.type, names, { arrays: 'ReadonlyArray' });
  if (field.name.endsWith('chat_id')) {
    type += ' | bigint';
  }
  if (field.upload) {
    type += ' | BotModels["InputFile"]';
  }
  return `${field.name}${field.optional ? '?' : ''}: ${type};`;
}
const { indexed, shared } = factorModelFields(facts.methods, property, true);
referenceModelFields(indexed, models.models, names);
function objectShape(node) {
  if (!node) {
    return 'object';
  }
  const parts = node.fields.size
    ? [`{${[...node.fields.values()].join('\n')}}`]
    : [];
  parts.push(...node.references.map((name) => `SharedMethodFields['${name}']`));
  parts.push(...(node.modelReferences ?? []));
  return parts.join(' & ');
}
const files = new Map();
const groups = [];
files.set(
  'shared.d.ts',
  `import type { BotModels } from '../bot-types/index.js';\nexport interface SharedMethodFields {${shared.map((node) => `${node.name}: ${objectShape(node)};`).join('\n')}}`
);
for (let offset = 0; offset < facts.methods.length; offset += 25) {
  const name = `Methods${offset / 25}`;
  groups.push(name);
  files.set(
    `${name.toLowerCase()}.d.ts`,
    `import type { BotModels } from '../bot-types/index.js';\nimport type { SharedMethodFields } from './shared.js';\nexport interface ${name} {${facts.methods
      .slice(offset, offset + 25)
      .map(
        (method) =>
          `${method.name}: {params: ${objectShape(indexed.get(method.name))}; result: ${factType(method.returns, names)};};`
      )
      .join('\n')}}`
  );
}
files.set(
  'index.d.ts',
  `${groups.map((name) => `import type { ${name} } from './${name.toLowerCase()}.js';`).join('\n')}\nexport interface BotApiMethodMap extends ${groups.join(', ')} {}`
);
const directory = new globalThis.URL('src/bot-method-types/', root);
await mkdir(directory, { recursive: true });
for (const [file, source] of files) {
  const output = await format(
    `// Independently generated official Bot API method facts.\n// Regenerate: node experiments/generate-bot-method-types.mjs\n${source}`,
    { parser: 'typescript', singleQuote: true, trailingComma: 'es5' }
  );
  const path = new globalThis.URL(file, directory);
  if (process.argv.includes('--check')) {
    if ((await readFile(path, 'utf8')) !== output) {
      throw new Error(`Stale Bot API method declaration: ${file}`);
    }
  } else {
    await writeFile(path, output);
  }
}
if (
  JSON.stringify((await readdir(directory)).sort()) !==
  JSON.stringify([...files.keys()].sort())
) {
  throw new Error('Unexpected Bot API method declaration file');
}
console.log(
  `Verified ${facts.methods.length} official method contracts and ${facts.methods.reduce((sum, method) => sum + method.fields.length, 0)} arguments`
);
