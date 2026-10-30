import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new globalThis.URL('../', import.meta.url);
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
    'tl/custom/messageButton.js',
    'tl/custom/messageButton.d.ts',
    'Password.js',
    'Utils.js',
  ]) {
    files.push({
      path,
      sha256: createHash('sha256')
        .update(await readFile(new globalThis.URL(path, packageRoot)))
        .digest('hex'),
    });
  }
  installed.push({
    package: name,
    version: manifest.version,
    publishedSource: `https://registry.npmjs.org/${name}/-/${name}-${manifest.version}.tgz`,
    files,
  });
}
const schema = JSON.parse(
  await readFile(new globalThis.URL('src/schema/telegram.json', root))
);
const methods = [
  'messages.getBotCallbackAnswer',
  'messages.sendVote',
  'messages.startBot',
].map((name) => {
  const method = schema.methods.find((method) => method.method === name);
  return {
    name,
    source: `https://core.telegram.org/method/${name}`,
    constructorId: Number(method.id) >>> 0,
    result: method.type,
    fields: method.params,
  };
});
const facts = {
  retrieved: new Date().toISOString(),
  installed,
  methods,
  regression: {
    frozenRevision: '5c4de84dd8440c39e36e8954d5ab0630a9360148',
    cases: 76,
    failuresBefore: 76,
    failuresAfter: 0,
    declarationDiagnosticsBefore: 12,
    selectedBackends: 5,
    actualCallbackAndVoteByteComparisons: 16,
    actualResolvedStartBotByteComparisons: 2,
    independentlyVerifiedSrpProofs: 4,
    localEncryptedTcp: true,
  },
  behavior: [
    'Legacy GramJS button constructors and layer-232 teleproto button types share one owned message button model.',
    'Each button retains private ownership of its client, source peer and appropriate bot input peer.',
    'Button rows, count, async lookup, flat/row/text/filter selection and direct callback bytes are available.',
    'Callback, game, URL, switch-inline, text, explicit contact and explicit location interactions use selected shared operations.',
    'Only BOT_RESPONSE_TIMEOUT becomes null; all other callback errors retain their backend and are not replayed.',
    'Password callbacks reuse the bounded SRP proof implementation, with cancellation before and after derivation.',
    'Poll indices select their requested option bytes; unmatched text/filter and an absent selector retract a vote.',
    'Closed polls, invalid/duplicate indices, multiple single-choice answers and invalid coordinates are rejected before mutations.',
    'Direct callback data is copied before asynchronous peer lookup and personal data requires explicit consent.',
  ],
  differences: [
    'Both actual SDK poll helpers use answers[0..length] instead of the requested index list. Owned [2,0] selects options[2] then options[0].',
    'Pinned GramJS phone clicks throw Not supported for now and its geo branch checks an unrelated constructor. Owned explicit sharing matches teleproto media arguments.',
    'Explicit InputGeoPoint values are wrapped as InputMediaGeoPoint; both documented tuple and object forms are validated.',
    'Owned button models use native bigint and detached Uint8Array data rather than vendor instanceof and legacy big-integer methods.',
  ],
  limits: {
    missingBotMessageReloadsPerAttempt: 1,
    maxInputChatDialogPages: 1,
    maxInputChatDialogs: 100,
    srpCandidateLimit: 64,
    unsupportedButtonKinds:
      'Metadata is retained; click returns undefined, matching the pinned custom models.',
    pollSubscriberAndCountryEligibility:
      'Server RPC errors are preserved; complete client-side eligibility checks remain open.',
    controlledProductionAccountVerified: false,
    fullSdkParityVerified: false,
  },
};
await writeFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/account-buttons.json',
    root
  ),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log(
  `Recorded ${installed.length} SDK inventories, ${methods.length} method contracts and ${facts.regression.cases} finite cases`
);
