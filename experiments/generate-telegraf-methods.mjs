import { readFileSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';
import {
  telegrafSignature,
  telegrafTypeTemplate,
} from './telegraf-method-type-template.mjs';

const root = new globalThis.URL('../', import.meta.url);
const inventory = JSON.parse(
  readFileSync(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/telegraf-bot-signatures.json',
      root
    )
  )
);
if (
  inventory.version !== '4.16.3' ||
  inventory.sha256 !==
    '664b6feea3b89d2490bdd6c3bfc9887568d4907c7eb58e2a94afeae67b6bb788'
) {
  throw new Error('Unreviewed Telegraf signature pin');
}
const manual = new Set([
  'getMe',
  'getFileLink',
  'sendMessage',
  'deleteMessage',
  'editMessageText',
  ...[
    'Photo',
    'Animation',
    'Video',
    'Audio',
    'Voice',
    'Document',
    'Sticker',
  ].map((type) => `send${type}`),
]);
const methods = new Map(
  JSON.parse(
    readFileSync(
      new globalThis.URL(
        'docs/case-studies/issue-1/data/bot-api/method-facts.json',
        root
      )
    )
  ).methods.map((method) => [method.name, method])
);
const runtime = [],
  declarations = [],
  routes = [];
for (const [name, item] of Object.entries(inventory.methods)) {
  const entry = inventory.methods[item.alias] ?? item;
  if (!entry.args || (!entry.fields && entry.helper !== 'fileLink')) {
    throw new Error(`Unreviewed Telegraf shape: ${name}`);
  }
  runtime.push(JSON.stringify(JSON.stringify([name, entry])));
  if (manual.has(name)) {
    continue;
  }
  const signature = telegrafSignature(name, entry, methods);
  declarations.push(signature.declaration);
  routes.push(signature.result);
}
const files = {
  'src/telegraf-method-signatures.js': `// Public facts from pinned Telegraf 4.16.3; no SDK implementation.\n// Regenerate: node experiments/generate-telegraf-methods.mjs\nexport const telegrafMethodSignatures = Object.freeze([\n${runtime.join(',\n')}\n]);\n`,
  'src/telegraf-positional.d.ts': telegrafTypeTemplate(declarations, routes),
};
for (const [file, source] of Object.entries(files)) {
  const output = await format(source, {
    filepath: file,
    singleQuote: true,
    trailingComma: 'es5',
  });
  const path = new globalThis.URL(file, root);
  if (process.argv.includes('--check')) {
    if (readFileSync(path, 'utf8') !== output) {
      throw new Error(`Stale Telegraf facts or declarations: ${file}`);
    }
  } else {
    writeFileSync(path, output);
  }
}
console.log(`Verified ${runtime.length} public Telegraf mappings`);
