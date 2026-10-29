# Rich messages and full-content retrieval

The shared `Rich` namespace supplies HTML, Markdown and block input factories,
and plain-text, Markdown and HTML renderers. Both account styles expose
`richText`, `richMarkdown`, `richHtml` and origin-bound `fetchRichMessage`.
Canonical clients and both styles share `getRichMessage` through the selected
transport. These APIs extend the pinned teleproto behavior to owned styles;
the pinned GramJS version has no rich-message implementation or schema.

The source inventory compares all 104 related local definitions against
[Telegram Desktop's immutable schema](https://github.com/telegramdesktop/tdesktop/blob/f1309a2456fb13161f8dc28984d7dec8d6cd8390/Telegram/SourceFiles/mtproto/scheme/api.tl),
including constructor IDs, field order, flags and return types. Telegram's rich
message method, constructor and overview documentation URLs return HTTP 404.
The [recorded facts](data/rich-messages.json) retain those statuses, the primary
schema revision/hash and the inspected SDK source hashes.

Factories produce owned API classes and detach nested inputs. File dictionaries
accept input photos/documents and preserve exact case-sensitive labels, including
`CoverPhoto`, `className`, `_` and an own `__proto__` key. Optional flags and
media vectors match actual teleproto factory bytes. HTML and Markdown factories
create inputs for Telegram's server parser; they do not parse ordinary message
markup locally. Renderers preserve exact media/user IDs and accept canonical,
owned and actual SDK class trees. They reference media IDs without fetching files.

All 32 RichText and 41 PageBlock constructors have comparisons in three modes
and three object representations, producing 657 cases. Another 36 cases cover
all twelve inline button types in text buttons and block rows. Fifteen string
expectations are independent of the SDK. Nested list/table/media content,
escaping, future wrapper fallbacks and empty unsupported block output are tested.
SDK-compatible quirks include omitted audio HTML captions and ordered HTML lists
that ignore per-item numbering. Rendering does not promise browser sanitization
of arbitrary links or lossless export for block types unsupported by the SDK.

Preflight bounds the tree before normalization: 100,000 visited nodes, depth 64,
100,000 entries per vector and four MiB of combined string code units and byte
array data. Rendered output is capped at sixteen MiB of code units. Cyclic trees,
repeated-child amplification, oversized vectors and output expansion use finite
regressions under bounded Node memory/stack settings.

Full-content retrieval retains each bound message's resolved origin, including
its access hash. Only a response matching both the requested message ID and exact
peer family/ID can replace the rich field. Safe numeric and decimal-string peer
IDs compare exactly; unsafe numbers do not. The actual teleproto helper falls
back to a wrong-ID message when no match exists; a regression documents that
difference, while Anygram returns undefined. Fetching absent or already complete
rich content is local. Concurrent caller replacement is preserved, unrelated
fields remain unchanged, and views remain detached. Cancellation rejects before
lookup and after the response. Typed transport failures keep their selected
backend without replay.

All 816 focused cases pass; immutable preceding source fails 806. Ten invalid-file
checks also pass against missing APIs because both throw TypeError; those are
not counted as reproduced failures. Thirty-one factory/fetch/send/edit request
byte comparisons use actual current SDK helpers or constructors. Five selected
adapter routes and four independent encrypted native TCP requests verify routing
and wire behavior. Rich-only sends supply the required empty plain-message field;
four regressions reproduced its absence before the fix. Frozen declarations
produce six diagnostics; the checked public example and actual SDK fixture compile.

The selected pinned GramJS Api explicitly rejects `messages.getRichMessage`
before calling its backend because its schema lacks the constructor. Five-route
current-schema comparisons supply teleproto's current Api explicitly for the
GramJS and teleproto invocation adapters. They do not establish an older-SDK
schema bridge or production interoperability.

All 3,628 core tests pass on Node, Bun and Deno. Strict checks and actual SDK
declaration compilation pass; the duplication gate scans 183 production sources
with zero clones, and packaging contains 226 permitted entries. The 71 framework
cases pass per runtime and on Node 20, alongside 27 native terminal cases, eight
Node 20 wire cases, sixteen official fact-parser checks and the bounded FIFO
probe. Main remains an ancestor. Refreshed issue prose is unchanged; all feedback
and sub-issue streams are empty. The existing PR inventory has 976 files and no
removals. GitHub's 300-file diff limit requires local review of the atomic change.

```sh
node --loader ./experiments/rich-messages-before-loader.mjs --test tests/rich-messages.test.js tests/account-rich-messages.test.js tests/account-rich-rpc.test.js
node --max-old-space-size=512 --stack-size=512 --test tests/rich-messages.test.js tests/account-rich-messages.test.js tests/account-rich-rpc.test.js
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --rich-messages --before
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --rich-messages
GOMEMLIMIT=768MiB GOGC=50 node node_modules/typescript/bin/tsc --project experiments/tsconfig.bot-filters.json
node experiments/record-rich-message-facts.mjs
```

The runtime loader freezes index.js, account-message.js, operations.js,
gram-style.js, client.js and adapters.js at
85aff538bf61684423c831ab17b8c08bdfbac5e1. The declaration runner freezes index.d.ts
and account-message-types.d.ts while keeping the example unchanged. This advances
R01/R02/R05/R17/R19. Fully refined rich-node declarations, ordinary markup parse
modes, older-SDK current-schema support, full model parity, controlled-account
verification and every wider unfinished criterion remain open.
