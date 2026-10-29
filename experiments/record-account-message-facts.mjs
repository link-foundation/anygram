import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';

const root = new globalThis.URL('../', import.meta.url);
const installed = [];
for (const [name, Vendor] of [
  ['telegram', GramApi],
  ['teleproto', TeleApi],
]) {
  const manifest = JSON.parse(
    await readFile(
      new globalThis.URL(`node_modules/${name}/package.json`, root)
    )
  );
  const files = [];
  for (const relative of [
    'tl/custom/message.js',
    'tl/custom/message.d.ts',
    'tl/custom/chatGetter.js',
    'tl/custom/senderGetter.js',
    'tl/custom/file.js',
    name === 'telegram' ? 'client/messages.js' : 'client/methods/messages.js',
  ]) {
    const file = `node_modules/${name}/${relative}`;
    files.push({
      file,
      sha256: createHash('sha256')
        .update(await readFile(new globalThis.URL(file, root)))
        .digest('hex'),
    });
  }
  const members = new Set();
  for (
    let prototype = Vendor.Message.prototype;
    prototype && prototype !== Object.prototype;
    prototype = Object.getPrototypeOf(prototype)
  ) {
    for (const key of Object.getOwnPropertyNames(prototype)) {
      if (!key.startsWith('_') && key !== 'constructor') {
        members.add(key);
      }
    }
  }
  installed.push({
    package: name,
    version: manifest.version,
    files,
    messageMembers: [...members].sort(),
    defaultMessageDeleteRevoke: name === 'teleproto',
  });
}
const facts = {
  retrieved: new Date().toISOString(),
  sources: [
    'https://registry.npmjs.org/telegram/-/telegram-2.26.22.tgz',
    'https://gram.js.org/beta/classes/tl_custom_message.Message.html',
    'https://www.npmjs.com/package/telegram/v/2.26.22',
    'https://www.npmjs.com/package/teleproto/v/1.232.0',
  ],
  installed,
  regression: {
    frozenRevision: '8a37c45d45edeea94a62ed0afbaa1f4677fea151',
    cases: 101,
    failuresBefore: 94,
    failuresAfter: 0,
    declarationDiagnosticsBefore: 10,
    selectedBackends: 5,
    actualClientRpcByteComparisons: 6,
  },
  implemented: [
    'respond',
    'reply',
    'edit',
    'delete',
    'forwardTo',
    'downloadMedia',
    'pin',
    'unpin',
    'markAsRead',
    'getReplyMessage',
    'getChat',
    'getInputChat',
    'getSender',
    'getInputSender',
    'getEntitiesText',
    'rawText',
    'text',
    'client',
    'chatId',
    'senderId',
    'chat',
    'sender',
    'inputChat',
    'inputSender',
    'isPrivate',
    'isChannel',
    'isGroup',
    'isReply',
    'replyToMsgId',
    'photo',
    'document',
    'webPreview',
    'audio',
    'voice',
    'video',
    'videoNote',
    'gif',
    'sticker',
    'contact',
    'game',
    'geo',
    'invoice',
    'poll',
    'venue',
    'dice',
    'file',
  ],
  differences: [
    'Owned views use native bigint and copied typed arrays, without vendor instanceof or legacy big-integer methods.',
    'GramJS delete defaults to revoke=false; teleproto defaults to revoke=true. Separate style contexts share the same operation implementation.',
    'Both pinned SDK document file width/height/duration getters throw on instanceof an array. Owned metadata uses matching attributes.',
    'Caller reply/edit options remain unchanged; both pinned models mutate reply/edit parameters.',
    'Short sent messages retain explicit formatting entities; uncorrelated new-message updates are not returned as a sent result.',
    'Matching request InputPeers remain private per-message origins and take priority over missing or conflicting response entity hashes.',
  ],
  remaining: [
    'button models and click interactions',
    'parseMode formatting and rich text getter/setter parity',
    'forward models and actionEntities',
    'sender refetch/input-from-message fallback',
    'full send/edit file and album shortcut options',
    'toId/self identity and via-bot metadata',
    'vendor raw TL serialization methods on detached views',
    'controlled production Telegram interoperability',
  ],
  limits: {
    maxCachedPeerKeys: 10000,
    maxInputChatDialogPages: 1,
    maxInputChatDialogs: 100,
    replyLookupsPerAttempt: 2,
    productionTelegramVerified: false,
    fullCustomModelParityVerified: false,
  },
};
await writeFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/account-messages.json',
    root
  ),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log(
  `Recorded ${installed.length} installed message inventories and ${facts.regression.cases} finite regressions`
);
