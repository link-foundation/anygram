# Context chat administration comparisons

The context layer now binds all 55 chat administration, author and forum helper
names in pinned grammY 1.46.0 and all 40 in pinned Telegraf 4.16.3. These bindings
derive context identifiers and call the shared positional APIs, retaining the
selected backend and request controls. Production imports no optional SDK.

The independently supplied argument inventory is
[`tests/fixtures/context-admin.js`](../../../../tests/fixtures/context-admin.js).
Each helper is checked against the actual SDK prototype and API payloads. The
source fingerprints are the same pinned contexts documented in
[the delivery comparison](bot-context-delivery.md).

## Reproduction and cause

At preceding head `d14764fd5ebccd2ae7b00bfe4c2b55b09f997a5c`, these context
helpers were absent, although their underlying positional API operations existed.
Run the current tests against that preceding context module:

```sh
node --loader ./experiments/context-admin-before-loader.mjs \
  --test tests/bot-context-admin.test.js
```

The loader reads a fixed Git revision with a 64 KiB output bound and leaves the
working tree, current tests and actual SDKs intact. It reproduces 204 failures
and two passing inventory checks in 206 cases. The initial 192-case suite was
executed before implementation and reproduced 190 failures. Local logs are in
`ci-logs/context-admin-before-pinned.log` and `context-admin-before.log`.

## Preserved behavior

The common helpers cover membership moderation, permissions, invite links and
join requests, chat metadata/photos/stickers, pinned messages, membership queries
and forum/general topics. grammY also supplies author shortcuts, member tags,
subscription invite links, chat gifts, verification and deprecated aliases.
The inventory fixes the exact 55/40 counts rather than implying that all context
APIs or all current Telegram models are complete.

grammY binds chat methods to `chatId`, including business-connection updates
without a chat object. Author methods additionally require `from`. Forum methods
bind the current message's chat and thread, including callback messages.
Pin and unpin inherit the business connection; caller options take precedence.
Aliases dispatch dynamically, preserving overrides. Error method labels retain
the pinned `revokeChatInviteLink` and `setAuthorTag` quirks.

Telegraf requires `chat` and its forum methods require the direct `message`
update's thread. Callback or edited-message threads do not substitute for it.
Its public `assert` hook retains override order and SDK error types. Ban accepts
a separate until-date argument; restrict accepts its permissions inside the
options object. Its deprecated count helper sends `getChatMembersCount`, while
grammY sends `getChatMemberCount`, matching their actual pinned implementations.
All checks distinguish an absent identifier from zero.

Declarations reuse regenerated positional argument tuples, remove the context
prefixes and preserve SDK-specific signatures. Optional unpin message identifiers
remain optional. The checked
[example](../../../../examples/typed-bot-context-admin.ts) exercises author,
forum, business, subscription, cancellation and the two moderation styles.
Complete SDK argument/result models remain unfinished.

## Verification and limits

All 206 focused cases pass. They compare five update shapes, all missing-scope
errors, input ownership, aliases, business overrides, signals and deadlines.
Eight HTTP cases exercise forum edits, pinning and counts through actual selected
native, grammY, Telegraf and node-telegram-bot-api backends. Pre-cancellation of
every helper produces no HTTP request. Final signal and embedded deadline fields
never enter Telegram payloads.

All 1,564 core cases pass on Node, Bun and Deno. The 206 focused Node 20 cases,
26 native checks, two vendor wire cases and bounded FIFO probe pass. Strict
checks scan 97 production sources with zero clones; all declarations regenerate
exactly and the package contains 140 permitted entries.
Context edit/query/file/business/story/gift/filter/entity methods, full
SDK models, downstream application parity, controlled live interoperability and
every other open acceptance criterion remain unfinished. PR #2 remains draft
and unmerged.
