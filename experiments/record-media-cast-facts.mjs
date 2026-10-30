import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import schema from '../src/schema/telegram.json' with { type: 'json' };
import { mediaInputTypes } from '../src/tl-media.js';

const root = new globalThis.URL('../', import.meta.url);
const installed = [];
for (const packageName of ['telegram', 'teleproto']) {
  const manifest = JSON.parse(
    await readFile(
      new globalThis.URL(`node_modules/${packageName}/package.json`, root)
    )
  );
  const files = [];
  const runtime =
    packageName === 'telegram' ? 'tl/api.js' : 'tl/runtime/inputCasts.js';
  for (const relative of [
    runtime,
    'tl/api.d.ts',
    'Utils.js',
    'Utils.d.ts',
    ...(packageName === 'teleproto' ? ['tl/generated/api.d.ts'] : []),
  ]) {
    const file = `node_modules/${packageName}/${relative}`;
    const bytes = await readFile(new globalThis.URL(file, root));
    files.push({
      file,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  const api = await readFile(new globalThis.URL(files[0].file, root), 'utf8');
  const block =
    packageName === 'telegram'
      ? /const AUTO_CASTS = new Set\(\[([\s\S]*?)\]\)/.exec(api)?.[1]
      : /const TYPE_CASTS = new Set\(\[([\s\S]*?)\]\)/.exec(api)?.[1];
  if (!block) {
    throw new Error(`Missing SDK cast inventory: ${packageName}`);
  }
  installed.push({
    package: packageName,
    version: manifest.version,
    files,
    automaticTypes: [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]),
    namedChatIdShortcut: api.includes('"chatId,int"')
      ? 'chatId,int'
      : api.includes('"chatId,long"')
        ? 'chatId,long'
        : null,
  });
}
const fields = [];
for (const entry of [...schema.constructors, ...schema.methods]) {
  for (const field of entry.params) {
    const type = field.type
      .replace(/^\w+\.\d+\?/, '')
      .replace(/^(?:Vector|vector)<(.+)>$/, '$1');
    if (mediaInputTypes.has(type)) {
      fields.push({
        owner: entry.predicate ?? entry.method,
        ...field,
        target: type,
      });
    }
  }
}
const facts = {
  retrieved: new Date().toISOString(),
  schemaLayer: schema.layer,
  schemaSource: schema.source,
  sources: [
    'https://github.com/gram-js/gramjs/blob/v2.26.22/gramjs/Utils.ts',
    'https://www.npmjs.com/package/telegram/v/2.26.22',
    'https://www.npmjs.com/package/teleproto/v/1.232.0',
    'https://core.telegram.org/constructor/inputMediaPoll',
    'https://core.telegram.org/constructor/pollAnswer',
    'https://core.telegram.org/constructor/inputPollAnswer',
    'https://core.telegram.org/api/poll',
  ],
  installed,
  mediaFields: fields,
  regression: {
    frozenRevision: '67f631532971f4d38adb265948960d2a8432fa57',
    tests: 143,
    failuresBefore: 129,
    focusedIncludingPeerResolution: 160,
    declarationDiagnosticsBefore: 5,
    sdkArgumentComparisons: 106,
    uploadedFilenameComparisons: 20,
  },
  differences: [
    'The pinned declarations require explicit media helper calls despite runtime request autocasts.',
    'Layer 232 correct_answers are indices into poll.answers. Pinned teleproto returns byte options that encode as the wrong integer.',
    'PollAnswer.media remains MessageMedia in the pinned schema. Pinned teleproto converts it to InputMedia and mutates the source poll.',
    'Only 28 common filename extensions have implicit MIME metadata; other extensions use application/octet-stream. Explicit InputMedia retains caller metadata.',
  ],
  limits: {
    maxDepth: 64,
    maxVector: 100000,
    implicitNetworkUploads: false,
    productionTelegramDeliveryVerified: false,
    fullMediaHelperOptionParityVerified: false,
  },
};
await writeFile(
  new globalThis.URL('docs/case-studies/issue-1/data/media-casts.json', root),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log(
  `Recorded ${fields.length} layer-${schema.layer} media fields and ${installed.length} installed SDK inventories`
);
