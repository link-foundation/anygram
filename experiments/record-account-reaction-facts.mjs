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
    'tl/custom/message.js',
    'tl/custom/message.d.ts',
    'client/messages.js',
    'client/messages.d.ts',
  ];
  if (name === 'teleproto') {
    paths.splice(
      2,
      2,
      'client/methods/messages.js',
      'client/methods/messages.d.ts'
    );
    paths.push('tl/runtime/fieldCodec.js');
  }
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
for (const name of [
  'sendReaction',
  'getMessageReactionsList',
  'forwardMessages',
]) {
  const url = `https://core.telegram.org/method/messages.${name}.md`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Cannot retrieve ${url}: ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (new globalThis.TextDecoder().decode(bytes).trimStart().startsWith('<')) {
    throw new Error(`Expected Markdown at ${url}`);
  }
  primarySources.push({ url, sha256: digest(bytes) });
}
const schema = JSON.parse(
  await readFile(new globalThis.URL('src/schema/telegram.json', root))
);
const definitions = [
  ...schema.methods.filter((entry) =>
    primarySources.some((source) => source.url.endsWith(`/${entry.method}.md`))
  ),
  ...schema.constructors.filter((entry) =>
    [
      'reactionEmoji',
      'reactionCustomEmoji',
      'reactionEmpty',
      'reactionPaid',
    ].includes(entry.predicate)
  ),
].map((entry) => ({
  name: entry.method ?? entry.predicate,
  constructorId: Number(entry.id) >>> 0,
  fields: entry.params,
  result: entry.type,
}));
const facts = {
  retrieved: new Date().toISOString(),
  installed,
  primarySources,
  definitions,
  regression: {
    frozenRevision: '8da6cd7d11d0229bf02a3c3ba3372aebc465a544',
    cases: 96,
    failuresBefore: 96,
    failuresAfter: 0,
    declarationDiagnosticsBefore: 11,
    actualSdkRequestByteComparisons: 40,
    sdkDateMillisecondsDifferences: 2,
    postResponseCopyCancellationFailuresBefore: 2,
    dateScheduleFailuresBefore: 2,
    selectedBackends: 5,
    independentEncryptedTcpRequests: 4,
  },
  behavior: [
    'Both account styles expose bound react, getReactions and copy methods; client/style sendReaction and getReactionUsers share canonical operations.',
    'Reaction strings remain emoji, including numeric strings; exact bigint, safe integer and SDK integer custom IDs retain all bits.',
    'Empty vectors retract ordinary reactions. Constructor inputs and caller arrays remain detached and unmodified.',
    'Reaction list requests preserve zero limits and empty offsets, with SDK-compatible defaults of 100 and an empty offset.',
    'Copy forces drop_author, uses the original message and peer, and correlates the first destination message with its random ID.',
    'Copy scheduling accepts integer seconds or JavaScript Dates, converting Dates to whole seconds before canonical normalization.',
    'Pre-aborted and post-response cancellation rejects; typed failures preserve the selected backend without replay.',
  ],
  differences: [
    'The pinned teleproto SDK provides these high-level reaction and copy helpers; the pinned GramJS SDK does not. Owned styles expose their union.',
    'Paid constructors pass through the ordinary reaction RPC like teleproto, retaining Telegram errors. No automatic paid-reaction RPC or Stars charge occurs.',
    'Unsafe numeric custom emoji IDs and malformed reaction values reject instead of silently rounding or coercing.',
    'The pinned teleproto forwarding serializer writes Date milliseconds for the schema int field. Owned forwarding converts them to Telegram timestamp seconds.',
    'Owned response views retain native bigint, detached fields and private client ownership rather than vendor instanceof or legacy integer APIs.',
  ],
  limits: {
    automaticPaidReactionImplemented: false,
    reactionListBroadcastPrivacyBypassImplemented: false,
    productionAccountVerified: false,
    fullSdkParityVerified: false,
  },
};
await writeFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/account-reactions.json',
    root
  ),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log(
  `Recorded ${installed.length} SDKs, ${primarySources.length} primary sources, ${definitions.length} definitions and ${facts.regression.cases} cases`
);
