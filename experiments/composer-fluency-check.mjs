import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new globalThis.URL('../', import.meta.url));
const modes = {
  '--account-markdown': [
    ['typed-account-markdown.ts'],
    'f315c14e5e14256b8823537af2e163dfa5296c1c',
  ],
  '--account-html': [
    ['typed-account-html.ts'],
    '2c40acd5ade91284195e2363c41d28f22e96de6d',
  ],
  '--account-parse-mode': [
    ['typed-account-parse-mode.ts'],
    '2e0eecc164df94c0af5a2c0109fba83e927916fb',
  ],
  '--rich-messages': [
    ['typed-rich-messages.ts'],
    '85aff538bf61684423c831ab17b8c08bdfbac5e1',
  ],
  '--account-reactions': [
    ['typed-account-reactions.ts'],
    '8da6cd7d11d0229bf02a3c3ba3372aebc465a544',
  ],
  '--account-peers': [
    ['typed-account-peers.ts'],
    '1d5a564b133afa3e33ac22200f3caa29a219fa0a',
  ],
  '--account-buttons': [
    ['typed-account-buttons.ts'],
    '5c4de84dd8440c39e36e8954d5ab0630a9360148',
  ],
  '--account-messages': [
    ['typed-account-messages.ts'],
    '8a37c45d45edeea94a62ed0afbaa1f4677fea151',
  ],
  '--media': [
    ['typed-media-casts.ts'],
    '67f631532971f4d38adb265948960d2a8432fa57',
  ],
  '--telegraf-agents': [
    [
      'typed-telegraf-agents.ts',
      'typed-telegram-constructor.ts',
      'typed-telegram-namespace.ts',
    ],
    'ce24156ce1d785a995036d1557fae97962df21d6',
  ],
  '--telegraf-options': [
    ['typed-telegraf-options.ts'],
    '8874fdbc9e59261c337e3482116e7dfadd676c31',
  ],
  '--telegraf-lifecycle': [
    ['typed-telegraf-lifecycle.ts'],
    '197d5a1baedf3f10c24e6005a08fad79518e68ee',
  ],
  '--frameworks': [
    ['typed-grammy-frameworks.ts', 'typed-webhook-defaults.ts'],
    'b73f33041ba5ac00895d4b808ecd48947c33de4f',
  ],
  '--webhooks': [
    ['typed-grammy-webhook.ts', 'typed-telegraf-webhook.ts'],
    'd4c76ce80b21943390dd4f762f247e0301194069',
  ],
  '--components': [
    ['typed-grammy-components.ts', 'typed-telegraf-components.ts'],
    '2dbeff7aaa23d56e12bf9bf18e227dafb1c29d81',
  ],
  '--message-subtypes': [
    ['typed-grammy-message-subtypes.ts', 'typed-telegraf-message-subtypes.ts'],
    'cb9f92cfdb401628e1a2f6aef392a1696427c61a',
  ],
  '--delivery-arguments': [
    [
      'typed-grammy-delivery-arguments.ts',
      'typed-telegraf-delivery-arguments.ts',
      'typed-bot-upload-arguments.ts',
    ],
    '606e831242547be69e36929ee9f35af1a25987fa',
  ],
  '--context-results': [
    ['typed-grammy-context-results.ts', 'typed-telegraf-context-results.ts'],
    '2dbc782abe55d2251a323fbc7628c93491ae7200',
  ],
  '--methods': [
    [
      'typed-bot-api-methods.ts',
      'typed-bot-api-extensions.ts',
      'typed-telegraf-api-methods.ts',
    ],
    '565d6fe616a23862ae742705d1169d4392b02029',
  ],
  '--telegraf-filters': [
    'typed-telegraf-filters.ts',
    'bebfa138ce830b9d5453fd974e3a80849fd19120',
  ],
  '--filters': [
    'typed-filter-narrowing.ts',
    '4d6c1ca33b62a06500312a106e2638a9f80b66d0',
  ],
  '--models': [
    'typed-bot-models.ts',
    'baa796927da5cc69ea00040e00c3936c25e4ea60',
  ],
  default: [
    'typed-composer-fluency.ts',
    '84328a107c89a8b4cbd7eddd67dfdb2444603688',
  ],
};
const mode =
  Object.keys(modes).find((key) => process.argv.includes(key)) ?? 'default';
const [selected, revision] = modes[mode];
const fixtures = Array.isArray(selected) ? selected : [selected];
const frozen = new Set([
  ...([
    '--account-buttons',
    '--account-peers',
    '--account-reactions',
    '--rich-messages',
    '--account-parse-mode',
    '--account-html',
    '--account-markdown',
  ].includes(mode)
    ? ['src/account-message-types.d.ts']
    : []),
  ...(mode === '--media' ? ['src/api-classes.d.ts'] : []),
  ...(mode === '--telegraf-agents'
    ? ['src/telegraf-server-types.d.ts', 'src/bot-input-types.d.ts']
    : []),
  ...(mode === '--telegraf-options' ? ['src/telegraf-server-types.d.ts'] : []),
  'src/index.d.ts',
  'src/telegraf-composer.d.ts',
  ...(['--components', '--message-subtypes'].includes(mode)
    ? ['src/bot-api-types.d.ts', 'src/bot-types/index.d.ts']
    : []),
  ...(mode === '--delivery-arguments'
    ? ['src/bot-context-delivery.d.ts', 'src/bot-api-types.d.ts']
    : []),
  ...(['--filters', '--telegraf-filters'].includes(mode)
    ? ['src/bot-context-checkers.d.ts']
    : []),
  ...(mode === '--methods'
    ? [
        'src/bot-positional.d.ts',
        'src/telegraf-positional.d.ts',
        'src/bot-context-scope.d.ts',
      ]
    : []),
  ...(mode === '--context-results'
    ? [
        'src/bot-context-scope.d.ts',
        'src/bot-context-admin.d.ts',
        'src/bot-context-services.d.ts',
        'src/bot-context-message-actions.d.ts',
        'src/bot-context-delivery.d.ts',
      ]
    : []),
]);
const before = process.argv.includes('--before');
const workspace = await mkdtemp(join(tmpdir(), 'anygram-fluency-'));

async function declarations(relative) {
  await mkdir(join(workspace, relative), { recursive: true });
  for (const entry of await readdir(join(root, relative), {
    withFileTypes: true,
  })) {
    const path = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      await declarations(path);
    } else if (entry.name.endsWith('.d.ts')) {
      const content =
        before &&
        mode === '--telegraf-agents' &&
        path === 'src/telegraf-api.d.ts'
          ? 'export {};\n'
          : before &&
              (frozen.has(path) ||
                (mode === '--media' && path.startsWith('src/api-types/')))
            ? execFileSync('git', ['show', `${revision}:${path}`], {
                cwd: root,
                maxBuffer: 128 * 1024,
              })
            : await readFile(join(root, path));
      await writeFile(join(workspace, path), content);
    }
  }
}

try {
  await declarations('src');
  await mkdir(join(workspace, 'examples'));
  for (const fixture of fixtures) {
    await writeFile(
      join(workspace, 'examples', fixture),
      await readFile(join(root, 'examples', fixture))
    );
  }
  await writeFile(join(workspace, 'package.json'), '{"type":"module"}\n');
  await writeFile(
    join(workspace, 'tsconfig.json'),
    await readFile(join(root, 'tsconfig.json'))
  );
  const result = spawnSync(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '--project', workspace],
    { encoding: 'utf8', maxBuffer: 256 * 1024 }
  );
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
}
