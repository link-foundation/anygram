import { readFileSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';
import { grammyTypeTemplate } from './bot-positional-type-template.mjs';

const root = new globalThis.URL('../', import.meta.url);
const inventory = JSON.parse(
  readFileSync(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/grammy-bot-signatures.json',
      root
    )
  )
);
if (
  inventory.version !== '1.46.0' ||
  inventory.sha256 !==
    'd9e92656ccb5fb463aead3be745dfee868ae2b5f4176fbdb5ebe9d93f252a51d'
) {
  throw new Error('Unreviewed pinned bot signature inventory');
}
const aliases = {
  kickChatMember: 'banChatMember',
  getChatMembersCount: 'getChatMemberCount',
};
const conditional = new Set([
  'getMyName',
  'editMessageText',
  'editMessageTextInline',
  'editEphemeralMessageText',
]);
const manualTypes = new Set([
  'getMe',
  'sendMessage',
  'deleteMessage',
  'answerCallbackQuery',
  'editMessageText',
  'editMessageTextInline',
  ...[
    'Photo',
    'Animation',
    'Video',
    'Audio',
    'Voice',
    'Document',
    'Sticker',
  ].map((media) => `send${media}`),
]);
const runtime = [],
  declarations = [],
  routes = [];
for (const [name, entry] of Object.entries(inventory.methods)) {
  const value = inventory.methods[aliases[name] ?? name];
  const method = value.method ?? (name === 'sendPoll' ? name : undefined);
  if (
    !method ||
    value.args.at(-1) !== 'signal' ||
    (!value.fields &&
      value.args.length > 1 &&
      name !== 'sendPoll' &&
      !conditional.has(name))
  ) {
    throw new Error(`Unreviewed bot wrapper shape: ${name}`);
  }
  if (
    value.fields?.some(
      (field) =>
        field !== '...other' &&
        !value.args.some((argument) => field === `${argument}:${argument}`)
    )
  ) {
    throw new Error(`Unreviewed bot payload mapping: ${name}`);
  }
  const fields = value.args.filter(
    (argument) => !['other', 'signal'].includes(argument)
  );
  const signature = [
    ...fields,
    ...(value.args.includes('other') ? ['?'] : []),
  ].join(' ');
  runtime.push(
    JSON.stringify(
      `${name}${method === name ? '' : `=${method}`} ${signature}`.trim()
    )
  );
  if (!manualTypes.has(name)) {
    declarations.push(`${name}: ${JSON.stringify(signature)};`);
    if (method !== name) {
      routes.push(`${name}: ${JSON.stringify(method)};`);
    }
  }
  if (entry.args[0]?.startsWith('...') && !aliases[name]) {
    throw new Error('Unknown positional alias');
  }
}
const files = {
  'src/bot-method-signatures.js': `// Public method/parameter facts from pinned grammY 1.46.0; no SDK implementation.\n// Regenerate: node experiments/generate-bot-methods.mjs\nexport const botMethodSignatures = Object.freeze([\n${runtime.join(',\n')}\n]);\n`,
  'src/bot-positional.d.ts': grammyTypeTemplate(declarations, routes),
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
      throw new Error(`Stale bot declarations or metadata: ${file}`);
    }
  } else {
    writeFileSync(path, output);
  }
}
console.log(`Verified ${runtime.length} pinned bot method mappings`);
