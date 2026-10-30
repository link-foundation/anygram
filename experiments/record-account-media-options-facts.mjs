import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new globalThis.URL('../', import.meta.url);
const hash = (value) => createHash('sha256').update(value).digest('hex');
const installed = [];
for (const name of ['telegram', 'teleproto', 'mime']) {
  const packageRoot = new globalThis.URL(`node_modules/${name}/`, root);
  const manifest = JSON.parse(
    await readFile(new globalThis.URL('package.json', packageRoot))
  );
  const paths =
    name === 'mime'
      ? ['Mime.js', 'types/standard.js', 'types/other.js']
      : [
          'Utils.js',
          `${name === 'telegram' ? 'client/' : 'client/methods/'}uploads.js`,
          ...(name === 'teleproto'
            ? ['client/files/FileUploader.js', 'client/files/PartsManager.js']
            : []),
        ];
  const files = [];
  for (const path of paths) {
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
for (const constructor of [
  'inputMediaUploadedDocument',
  'inputMediaUploadedPhoto',
  'inputMediaDocument',
  'inputMediaPhoto',
]) {
  const url = `https://core.telegram.org/constructor/${constructor}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Primary source HTTP ${response.status}: ${url}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(
    new globalThis.URL(
      `ci-logs/account-media-options-${constructor}.html`,
      root
    ),
    bytes
  );
  primarySources.push({ url, sha256: hash(bytes) });
}
const facts = {
  recordedAt: new Date().toISOString(),
  installed,
  primarySources,
  contract: {
    inference:
      'High-level file sends/edits infer JPEG/PNG photos, registered MIME and filename/audio/video attributes. Explicit forceDocument/asImage/MIME/attributes retain caller control. Raw TL InputFile shortcuts remain documents.',
    metadata:
      'Both SDK styles and canonical operations share flags, exact detached references, thumbnail preparation and all-item preflight. Album uploadMedia retains reusable flags and live-photo video references.',
    uploads:
      'One to sixteen finite concurrent parts, ordered checksum/encryption preparation, fractional SDK progress beside canonical byte progress, cancellation and shared cleanup failure retention.',
    bounds:
      'At most ten album items, 1000 supplied attributes/stickers, 256 KiB per supplied metadata value, 64 MiB default upload limit and sixteen half-MiB in-flight parts.',
  },
  regression: {
    beforeCommit: '5ad1af7756479e63ab6162bacb9ee6de45d1e0ad',
    tests: [
      'tests/account-media-options.test.js',
      'tests/account-media-options-rpc.test.js',
      'tests/account-upload-controls.test.js',
    ],
    initialCases: 101,
    initialFailures: 97,
    finalCases: 153,
    frozenFailures: 146,
    retainedGuards: 7,
    actualFileHelperMediaComparisons: 32,
    exhaustiveExtensionFactsPerSdk: 1173,
    actualThumbnailComparisons: 2,
    selectedRouteCases: 10,
    encryptedTcpCases: 2,
    frozenCommand:
      'node --loader ./experiments/account-media-options-before-loader.mjs --test tests/account-media-options*.test.js tests/account-upload-controls.test.js',
    finiteProbe:
      'node --max-old-space-size=64 --stack-size=512 experiments/account-upload-budget.mjs',
  },
  differences: [
    'Owned uploads preserve real MD5 checksums; the pinned GramJS helper returns an empty checksum. Thumbnail comparison first asserts that difference and then normalizes only the checksum.',
    'Owned video notes use round-video attributes without the pinned SDK helper accidental voice-audio attribute. Explicit supplied attributes still override inferred attributes.',
    'Owned URL filename inference excludes query/fragment components; pinned helpers inspect unparsed strings.',
    'Owned upload workers are finite (1..16) and honor progress callbacks asynchronously. Default upload size remains bounded; explicit metadata controls actual duration/dimensions because pinned helpers do not parse binary metadata.',
    'Current flags on historical SDK schemas still depend on the older-schema bridge; common supported metadata is verified on all five selected adapters.',
  ],
  remaining: [
    'Older-schema bridging and complete account models',
    'Controlled-account delivery and downstream use cases',
    'Every wider unfinished issue criterion',
  ],
};
await writeFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/account-media-options.json',
    root
  ),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log(
  'Recorded primary media constructors, installed SDK upload helpers and finite comparison limits'
);
