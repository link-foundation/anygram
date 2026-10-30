import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new globalThis.URL('../', import.meta.url);
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex');
const installed = [];
for (const name of ['telegram', 'teleproto']) {
  const packageRoot = new globalThis.URL(`node_modules/${name}/`, root);
  const manifest = JSON.parse(
    await readFile(new globalThis.URL('package.json', packageRoot))
  );
  const paths = [
    'extensions/markdown.js',
    'extensions/markdown.d.ts',
    'extensions/html.js',
    'extensions/html.d.ts',
    'extensions/markdownv2.js',
    'extensions/markdownv2.d.ts',
    'tl/custom/message.js',
    'tl/custom/message.d.ts',
    ...(name === 'telegram'
      ? ['client/messageParse.js', 'client/messages.js', 'tl/patched/index.js']
      : ['client/methods/messageParse.js', 'client/methods/messages.js']),
  ];
  const files = [];
  for (const path of paths) {
    files.push({
      path,
      sha256: digest(await readFile(new globalThis.URL(path, packageRoot))),
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
for (const url of [
  'https://core.telegram.org/api/entities',
  'https://core.telegram.org/bots/api#formatting-options',
]) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cannot retrieve ${url}: ${response.status}`);
  }
  primarySources.push({
    url,
    sha256: digest(new Uint8Array(await response.arrayBuffer())),
  });
}

const facts = {
  recordedAt: new Date().toISOString(),
  installed,
  primarySources,
  contract: {
    offsetUnits: 'UTF-16 code units',
    default:
      'Plain text until configured; SDK built-in string modes remain a separate open criterion.',
    callbacks:
      'Synchronous parse(text) -> [text, entities], unparse(text, detached camelCase entities) -> text; receiver retained.',
    precedence:
      'Explicit formattingEntities/entities (including []) or FormattedText override parsing; false disables it.',
    limits: {
      textCodeUnits: 4 * 1024 * 1024,
      parserEntities: 1000,
      canonicalDepth: 64,
      canonicalVector: 100000,
    },
    mentions:
      'Resolve exact bigint user IDs, @names and +phones through the selected peer resolver; preserve self/from-message inputs and original hashes.',
  },
  differences: [
    'Pinned GramJS uses older send/edit constructor IDs. Compare complete SDK-serialized requests and current-codec fields after the four-byte method ID independently.',
    'Pinned GramJS patch copies text/rawText getters without their setters. Test the actual custom-message setter separately and retain working owned setters.',
    'Owned text getters recompute from current data/settings; SDK getters cache _text.',
    'Owned parser mentions preserve exact decimal IDs; SDK TextUrl mention parsing converts to Number.',
    'Owned mention resolution preserves typed failures without dropping links or replaying a send; SDK _replaceWithMention catches failures.',
    'Custom unparsers receive owned detached entities. Vendor parsers that require nominal instanceof checks (notably GramJS HTML unparse) require an adapted callback; owned built-in modes remain open.',
  ],
  regression: {
    files: [
      'tests/account-parse-mode.test.js',
      'tests/account-parse-mode-rpc.test.js',
    ],
    beforeCommit: '2e0eecc164df94c0af5a2c0109fba83e927916fb',
    frozenSourceRunner: 'experiments/account-parse-mode-before-loader.mjs',
    frozenDeclarationRunner:
      'node experiments/composer-fluency-check.mjs --account-parse-mode --before',
    sdkFixture: 'experiments/typed-account-parse-mode-sdk-fixture.ts',
  },
  remaining: [
    'Independent HTML/Markdown/MarkdownV2 string modes and their complete parse/unparse union',
    'SDK default Markdown selection',
    'Send/edit file and album parser integration',
    'Full model/declaration compatibility and controlled-account application verification',
  ],
};
await writeFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/account-parse-mode.json',
    root
  ),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log(
  `Recorded ${installed.length} SDKs and ${primarySources.length} primary formatting sources`
);
