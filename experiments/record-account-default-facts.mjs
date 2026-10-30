import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new globalThis.URL('../', import.meta.url);
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const installed = [];
for (const name of ['telegram', 'teleproto']) {
  const packageRoot = new globalThis.URL(`node_modules/${name}/`, root);
  const manifest = JSON.parse(
    await readFile(new globalThis.URL('package.json', packageRoot))
  );
  const prefix = name === 'telegram' ? 'client/' : 'client/methods/';
  const files = [];
  for (const path of [
    `client/${name === 'telegram' ? 'telegramBaseClient' : 'TelegramBaseClient'}.js`,
    'client/TelegramClient.js',
    `${prefix}messageParse.js`,
    `${prefix}messages.js`,
    `${prefix}uploads.js`,
    'tl/custom/message.js',
  ]) {
    files.push({
      path,
      sha256: hash(await readFile(new globalThis.URL(path, packageRoot))),
    });
  }
  installed.push({
    package: name,
    version: manifest.version,
    publishedSource: `https://registry.npmjs.org/${name}/-/${name}-${manifest.version}.tgz`,
    files,
  });
}
const primarySources = [];
for (const [name, url] of [
  [
    'gramjs-parser',
    'https://gram.js.org/beta/classes/TelegramClient.html#parseMode',
  ],
  ['telegram-entities', 'https://core.telegram.org/api/entities'],
]) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Primary source HTTP ${response.status}: ${url}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(
    new globalThis.URL(`ci-logs/account-default-${name}.html`, root),
    bytes
  );
  primarySources.push({ url, sha256: hash(bytes) });
}
const facts = {
  recordedAt: new Date().toISOString(),
  installed,
  primarySources,
  contract: {
    unconfigured:
      'Both account facades and their bound messages use independent legacy Markdown by default. Canonical methods remain plain across selected backends.',
    configured:
      'Explicit parser configuration is shared by canonical methods, both styles and bound views. Per-call undefined/null inherit; false disables one call.',
    disabled:
      'Constructor false/null disable. Constructor undefined leaves defaults unconfigured. Calling setParseMode or assigning parseMode with false/null/undefined explicitly disables globally.',
    scopes:
      'withBackend copies both parser identity and whether configuration exists, including explicit disable. Later parent/child settings remain independent.',
    precedence:
      'FormattedText and explicit entities bypass default parsing. Empty per-item album modes inherit, false disables. Keyboard text labels remain literal even with custom parsers.',
    boundary:
      'High-level-only GramJS/teleproto receive explicit canonical disable or the owned facade parser; vendor defaults cannot determine canonical message interpretation.',
  },
  regression: {
    beforeCommit: '86d7685503f19e647bd13e9a880f99b1d0e39c88',
    cases: 146,
    failingBefore: 96,
    passingGuardsBefore: 50,
    actualSdkRequestComparisons: 24,
    actualSdkModelComparisons: 2,
    encryptedTcpCases: 4,
    runtime:
      'node --loader ./experiments/account-default-before-loader.mjs --test tests/account-parser-defaults*.test.js',
    tests: [
      'tests/account-parser-defaults.test.js',
      'tests/account-parser-defaults-rpc.test.js',
    ],
  },
  differences: [
    'Canonical defaults intentionally remain plain; SDK-style defaults match each pinned SDK constructor.',
    'Native request bytes match the current schema; old GramJS request bytes match through its own serializer and through a separately translated current-schema request. This does not implement the old-schema result bridge.',
    'The pinned GramJS model patch loses the text setter; the comparison invokes its original CustomMessage setter directly. Owned setters remain available.',
    'Owned callbacks retain finite input/output/entity bounds and validation before upload consumption.',
  ],
  remaining: [
    'Complete media options and file inference',
    'Older-schema result bridges and refined SDK models',
    'Controlled-account and all wider unfinished issue criteria',
  ],
};
await writeFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/account-parser-defaults.json',
    root
  ),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log(
  'Recorded SDK parser defaults, exact-source evidence and regression limits'
);
