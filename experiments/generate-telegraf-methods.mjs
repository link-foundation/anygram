import { readFileSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';

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
const runtime = [],
  declarations = [];
for (const [name, item] of Object.entries(inventory.methods)) {
  const entry = inventory.methods[item.alias] ?? item;
  if (!entry.args || (!entry.fields && entry.helper !== 'fileLink')) {
    throw new Error(`Unreviewed Telegraf shape: ${name}`);
  }
  runtime.push(JSON.stringify(JSON.stringify([name, entry])));
  if (manual.has(name)) {
    continue;
  }
  const args = entry.args.map(
    (arg) =>
      `${arg.name}${Object.hasOwn(arg, 'default') || arg.name === 'extra' ? '?' : ''}: unknown`
  );
  declarations.push(`${name}: [${args.join(', ')}];`);
}
const files = {
  'src/telegraf-method-signatures.js': `// Public facts from pinned Telegraf 4.16.3; no SDK implementation.\n// Regenerate: node experiments/generate-telegraf-methods.mjs\nexport const telegrafMethodSignatures = Object.freeze([\n${runtime.join(',\n')}\n]);\n`,
  'src/telegraf-positional.d.ts': `import type { RequestOptions } from './index.js';\n// Public argument facts share one callable declaration and request boundary.\ninterface Signatures {\n${declarations.join('\n')}\n}\nexport type TelegrafPositionalApi = {\n[M in keyof Signatures]: (...args: [...Signatures[M], request?: RequestOptions | AbortSignal]) => Promise<unknown>;\n};\n`,
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
