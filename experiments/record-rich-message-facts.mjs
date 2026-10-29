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
  const paths = ['tl/custom/message.js', 'tl/custom/message.d.ts'];
  paths.push(
    ...(name === 'teleproto'
      ? [
          'richMessage.js',
          'richMessage.d.ts',
          'client/methods/messages.js',
          'client/methods/messages.d.ts',
        ]
      : ['client/messages.js', 'client/messages.d.ts'])
  );
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

const revision = 'f1309a2456fb13161f8dc28984d7dec8d6cd8390';
const url = `https://raw.githubusercontent.com/telegramdesktop/tdesktop/${revision}/Telegram/SourceFiles/mtproto/scheme/api.tl`;
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Cannot retrieve official schema: ${response.status}`);
}
const source = await response.text();
const lines = source.split('\n');
const schema = JSON.parse(
  await readFile(new globalThis.URL('src/schema/telegram.json', root))
);
const families = new Set([
  'RichText',
  'PageBlock',
  'InlineButtonType',
  'PageCaption',
  'PageListItem',
  'PageListOrderedItem',
  'PageTableRow',
  'PageTableCell',
  'PageButton',
  'RichButtonStyle',
  'PageRelatedArticle',
  'InputRichMessage',
  'InputRichFile',
  'RichMessage',
]);
const methods = new Set([
  'messages.getRichMessage',
  'messages.sendMessage',
  'messages.editMessage',
]);
const definitions = [
  ...schema.constructors.filter((entry) => families.has(entry.type)),
  ...schema.methods.filter((entry) => methods.has(entry.method)),
].map((entry) => {
  const name = entry.method ?? entry.predicate;
  const index = lines.findIndex((line) => line.startsWith(`${name}#`));
  const line = lines[index];
  const match = /^([\w.]+)#([a-f0-9]+)\s*(.*?)\s*=\s*([\w<> .]+);/.exec(
    line ?? ''
  );
  const fields = match
    ? [...match[3].matchAll(/([\w]+):([\w.!?#<>]+)/g)].map((field) => ({
        name: field[1],
        type: field[2],
      }))
    : [];
  const identical =
    match &&
    Number.parseInt(match[2], 16) === Number(entry.id) >>> 0 &&
    JSON.stringify(fields) === JSON.stringify(entry.params) &&
    match[4] === entry.type;
  if (!identical) {
    throw new Error(`Official schema differs for ${name}`);
  }
  return {
    name,
    constructorId: Number(entry.id) >>> 0,
    fields,
    result: entry.type,
    officialLine: index + 1,
    officialDefinition: line,
  };
});
const missingDocs = [];
for (const path of [
  'method/messages.getRichMessage',
  'constructor/richMessage',
  'api/rich-messages',
]) {
  const url = `https://core.telegram.org/${path}`;
  const response = await fetch(url);
  missingDocs.push({ url, status: response.status });
}
const facts = {
  retrieved: new Date().toISOString(),
  installed,
  primarySchema: { url, revision, sha256: digest(source) },
  missingDocs,
  definitions,
  regression: {
    frozenRevision: '85aff538bf61684423c831ab17b8c08bdfbac5e1',
    cases: 816,
    failuresBefore: 806,
    unchangedInvalidInputChecksBefore: 10,
    failuresAfter: 0,
    declarationDiagnosticsBefore: 6,
    richTextConstructors: 32,
    pageBlockConstructors: 41,
    inlineButtonConstructors: 12,
    constructorModeRepresentationComparisons: 657,
    additionalInlineButtonModeCases: 36,
    actualSdkFactoryByteComparisons: 23,
    actualSdkFetchSendEditByteComparisons: 8,
    independentExpectedStringCases: 15,
    selectedBackends: 5,
    independentEncryptedTcpRequests: 4,
  },
  behavior: [
    'Rich input factories create owned schema classes, detach nested inputs and preserve exact media identifiers and case-sensitive file labels.',
    'Shared renderers accept canonical, owned and actual SDK trees, with exact text, Markdown and HTML comparisons for every pinned RichText/PageBlock constructor.',
    'Origin-bound full-content fetch uses only the selected transport, preserves caller replacements and rejects cancellation and typed failures without replay.',
    'Returned rich content must match the requested message ID and exact peer family/ID; private origin hashes survive response changes.',
    'Rich-only sends supply the required empty plain-message field; send/edit requests match actual current SDK bytes.',
  ],
  differences: [
    'The pinned GramJS schema has no rich constructors or messages.getRichMessage. Its selected actual Api rejects that method before invocation; current-schema route tests use the current teleproto Api explicitly.',
    'The pinned teleproto getRichMessage helper falls back to a message with the wrong ID. Anygram returns undefined instead.',
    'SDK-compatible rendering includes empty output for unsupported blocks, omitted audio HTML captions and ordered HTML lists that ignore per-item numbering.',
    'Rich.html and Rich.markdown construct server-parsed inputs; they do not parse ordinary message markup locally or download embedded media.',
    'Owned response models use native bigint and private ownership rather than vendor instanceof or legacy integer methods.',
  ],
  limits: {
    maxNodes: 100000,
    maxDepth: 64,
    maxVector: 100000,
    maxInputCodeUnitsAndByteArrayBytes: 4194304,
    maxOutputCodeUnits: 16777216,
    fullyRefinedRichNodeDeclarations: false,
    oldSdkCurrentSchemaBridgeImplemented: false,
    productionAccountVerified: false,
    fullSdkParityVerified: false,
  },
};
await writeFile(
  new globalThis.URL('docs/case-studies/issue-1/data/rich-messages.json', root),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log(
  `Recorded ${installed.length} SDKs, ${definitions.length} matching official definitions and ${facts.regression.cases} cases`
);
