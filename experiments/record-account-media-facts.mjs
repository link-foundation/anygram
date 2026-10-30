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
    `${prefix}uploads.js`,
    `${prefix}uploads.d.ts`,
    `${prefix}messages.js`,
    `${prefix}messageParse.js`,
    'Utils.js',
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
for (const url of [
  'https://core.telegram.org/method/messages.sendMedia',
  'https://core.telegram.org/method/messages.sendMultiMedia',
  'https://core.telegram.org/method/messages.editMessage',
]) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Primary source HTTP ${response.status}: ${url}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  const name = new globalThis.URL(url).pathname.split('.').at(-1);
  await writeFile(
    new globalThis.URL(`ci-logs/account-media-${name}.html`, root),
    bytes
  );
  primarySources.push({ url, sha256: hash(bytes) });
}
const facts = {
  recordedAt: new Date().toISOString(),
  installed,
  primarySources,
  contract: {
    shared:
      'Canonical, GramJS/teleproto facades and bound file replies/edits use the same caption conversion and selected RPC boundary.',
    captions:
      'Scalar captions belong to the first album item; arrays follow item order. Single files accept the first caption in an array. All used album captions validate before any source is consumed.',
    precedence:
      'FormattedText owns its entities. Explicit formattingEntities/entities skip parsing; top-level entities belong only to the first album item. Per-item caption, mode and entities override inherited settings.',
    ordering:
      'Validate captions and resolve mention users and the destination before upload. Preserve cancellation and typed lookup/submission failures without backend replay.',
    media:
      'Reuse existing shared schema casts for InputMedia, Photo, Document, MessageMedia, InputPhoto, InputDocument and uploaded InputFile values. Copy reusable media byte references before handing them to a backend.',
    limits: {
      albumItems: [2, 10],
      albumCaptions: 10,
      textCodeUnits: 4194304,
      entitiesPerCaption: 1000,
    },
  },
  differences: [
    'Pinned SDK albums ignore formattingEntities; owned albums retain an explicit first-caption/per-item contract.',
    'Owned album item options and FormattedText are extensions; pinned SDKs accept raw file arrays and caption strings.',
    'Pinned GramJS layer 181 changes nested media/reply constructor IDs as well as method IDs. Complete bytes match when each request is serialized through the same SDK; current native bytes match teleproto and a separate current-schema translation of GramJS requests.',
    'Validation happens before upload consumption, including invalid later captions and replacement-file edits. Pinned edit helpers prepare files before parsing text.',
    'Top-level randomId never becomes a shared album item ID; per-item IDs remain independent.',
    'This verifies explicit parser settings. SDK default Markdown selection and complete media-option parity remain separate unfinished criteria.',
  ],
  regression: {
    beforeCommit: '78df293f58eb148780f74570cee57bdebc23bfca',
    cases: 172,
    failingBefore: 154,
    passingGuardsBefore: 18,
    frozenDeclarationDiagnostics: 10,
    actualSdkRequestComparisons: 15,
    actualSdkMediaCastComparisons: 78,
    encryptedTcpCases: 3,
    tests: [
      'tests/account-media-formatting.test.js',
      'tests/account-media-formatting-boundaries.test.js',
      'tests/account-media-formatting-rpc.test.js',
    ],
    runtime:
      'node --loader ./experiments/account-media-before-loader.mjs --test tests/account-media-formatting*.test.js',
    declarations:
      'node experiments/composer-fluency-check.mjs --account-media --before',
    sdkFixture: 'experiments/typed-account-media-sdk-fixture.ts',
    finiteProbe:
      'node --max-old-space-size=192 --stack-size=512 experiments/account-media-bounds.mjs',
  },
  remaining: [
    'SDK default parsing',
    'Complete media flags, file inference, thumbnails and upload option parity',
    'Older-schema RPC result bridges',
    'Controlled-account and wider issue acceptance criteria',
  ],
};
await writeFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/account-media-formatting.json',
    root
  ),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log(
  'Recorded caption rules, source hashes, comparisons and remaining criteria'
);
