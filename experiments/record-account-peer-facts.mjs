import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new globalThis.URL('../', import.meta.url);
const digest = (value) => createHash('sha256').update(value).digest('hex');
const installed = [];
for (const name of ['telegram', 'teleproto']) {
  const packageRoot = new globalThis.URL(`node_modules/${name}/`, root);
  const manifest = JSON.parse(
    await readFile(new globalThis.URL('package.json', packageRoot))
  );
  const files = [];
  for (const path of [
    'tl/custom/message.js',
    'tl/custom/message.d.ts',
    'tl/custom/forward.js',
    'tl/custom/forward.d.ts',
    'tl/custom/chatGetter.js',
    'tl/custom/chatGetter.d.ts',
    'tl/custom/senderGetter.js',
    'tl/custom/senderGetter.d.ts',
    'Utils.js',
  ]) {
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
for (const path of [
  'api/min',
  'constructor/user',
  'constructor/channel',
  'constructor/messageActionChatJoinedByLink',
]) {
  const url = `https://core.telegram.org/${path}.md`;
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
const constructors = [
  'inputPeerUserFromMessage',
  'inputPeerChannelFromMessage',
  'inputUserFromMessage',
  'inputChannelFromMessage',
  'messageActionChatJoinedByLink',
].map((name) => {
  const definition = schema.constructors.find(
    (entry) => entry.predicate === name
  );
  return {
    name,
    constructorId: Number(definition.id) >>> 0,
    fields: definition.params,
    result: definition.type,
  };
});
const facts = {
  retrieved: new Date().toISOString(),
  installed,
  primarySources,
  constructors,
  regression: {
    frozenRevision: '1d5a564b133afa3e33ac22200f3caa29a219fa0a',
    cases: 131,
    failuresBefore: 124,
    failuresAfter: 0,
    declarationDiagnosticsBefore: 8,
    actualLookupByteComparisons: 4,
    selectedBackends: 5,
    independentEncryptedTcpFamilies: 2,
  },
  behavior: [
    'Forward views retain the detached original header, cached sender/chat/input peers, exact IDs and private client ownership.',
    'Via-bot metadata, service action entities and identified self destinations share the existing canonical peer cache.',
    'Missing senders trigger one source-message reload; concurrent lookups share it and unavailable entities retain a source-message input fallback.',
    'Cached min users and channels refresh through the official inputUserFromMessage or inputChannelFromMessage constructor.',
    'User min updates preserve complete identity and protected fields, respect photo/status rules and track min_access_hash independently of the min flag.',
    'Channel min updates replace and clear only documented mutable fields, preserving complete access hashes and rights.',
    'Message sender, forward and mention contexts are retained from account views and raw response/update containers with a separate bounded cache.',
    'Each message prefers its own known origin hash over another message mentioning the same peer.',
    'Channel get/delete/read operations accept source-message channel inputs; stale username aliases are removed.',
    'Pre-aborted and post-response cancellation rejects without a follow-up request; typed RPC failures retain their selected backend.',
  ],
  differences: [
    'Both pinned SDKs look up an invite-link inviter as a channel, contrary to Telegram documenting a user ID. Owned actionEntities resolves the user.',
    'Both pinned SDK Forward declarations omit the runtime originalFwd field. Owned declarations include it and optional peer metadata.',
    'An incoming private message has no invented toId until a self user has been identified.',
    'Native bigint and detached data views retain the existing absence of vendor instanceof, serialization methods and legacy integer APIs.',
  ],
  limits: {
    defaultPeerEntries: 10000,
    defaultMessageContexts: 10000,
    retainedInputsPerView: 4,
    senderReloadsPerView: 1,
    inputChatDialogPagesPerLookup: 1,
    inputChatDialogsPerLookup: 100,
    botZeroHashFallbackVerified: false,
    userFullCacheInvalidationImplemented: false,
    persistentPeerDatabaseImplemented: false,
    productionAccountVerified: false,
    fullSdkParityVerified: false,
  },
};
await writeFile(
  new globalThis.URL('docs/case-studies/issue-1/data/account-peers.json', root),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log(
  `Recorded ${installed.length} SDKs, ${primarySources.length} primary sources, ${constructors.length} constructors and ${facts.regression.cases} cases`
);
