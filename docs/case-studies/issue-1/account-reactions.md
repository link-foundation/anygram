# Account reactions and copies

[PR #2](https://github.com/link-foundation/anygram/pull/2) adds shared `react`,
`getReactions` and `copy` methods to bound account messages. The pinned teleproto
SDK has these helpers; the pinned GramJS SDK does not. Both owned account styles
expose them, while canonical clients and both styles expose `sendReaction` and
`getReactionUsers` over the same operations and selected transport.

Emoji strings, exact custom emoji IDs and reaction constructors use
[messages.sendReaction](https://core.telegram.org/method/messages.sendReaction).
Numeric strings remain emoji text, matching teleproto. Custom IDs accept native
bigint, safe numbers and SDK integer objects; constructor IDs also accept decimal
strings. Unsafe numbers and malformed values reject before the reaction RPC.
Omitted/null reactions and empty vectors retract ordinary reactions. Inputs and
response views remain detached, with exact IDs and private client ownership.

Paid constructors follow teleproto's ordinary reaction request path. Telegram
documents that this method rejects paid reactions and requires a separate paid
method. Anygram retains that error and never sends a Stars transfer automatically.
Reaction-user lookup uses
[messages.getMessageReactionsList](https://core.telegram.org/method/messages.getMessageReactionsList)
with the SDK defaults of limit 100 and an empty offset. Explicit zero limits and
empty offsets survive, and `nextOffset` is optional on style responses. Telegram's
broadcast privacy restriction remains authoritative.

`copy` reuses correlated `forwardTo` delivery through
[messages.forwardMessages](https://core.telegram.org/method/messages.forwardMessages),
forcing `drop_author` and the original single message/source peer. It returns the
first correlated destination message, or undefined when no match exists. Caller
options cannot replace the source, message IDs or author-free behavior. Scheduled
copies accept integer timestamp seconds or JavaScript Dates. Dates become whole
seconds before canonical normalization, which otherwise drops Date state. The
pinned teleproto schema treats the schedule as an integer and writes a Date's
milliseconds; two regressions retain that SDK discrepancy alongside the correct
timestamp bytes. Cancellation rejects before work and after the response; typed
RPC failures retain the selected backend without replaying side effects.

All 96 focused cases pass. The immutable preceding source fails all 96. Forty
complete request byte comparisons use the actual teleproto helper/constructors;
two further comparisons document its Date discrepancy. Tests exercise all five
selected adapters and four requests over independent encrypted native TCP. Two
post-response copy tests reproduced ignored cancellation before the fix. Two Date
tests reproduced invalid serialized schedules. Frozen declarations produce eleven
diagnostics; the checked example and actual SDK declaration fixture compile with
the new public contracts. The [source inventory](data/account-reactions.json)
records package versions, hashes, official methods, schema fields and limits.

All 2,812 core tests pass on Node, Bun and Deno. Strict checks scan 177 production
sources with zero clones; packaging contains 220 permitted entries. The 71
installed-framework tests pass per runtime, alongside 27 native terminal tests,
eight Node 20 wire tests, sixteen fact-parser checks and the bounded FIFO probe.
These checks do not establish controlled-account or complete ecosystem parity.

```sh
node --loader ./experiments/account-reactions-before-loader.mjs --test tests/account-reactions.test.js tests/account-reaction-rpc.test.js
node --test tests/account-reactions.test.js tests/account-reaction-rpc.test.js
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --account-reactions --before
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --account-reactions
GOMEMLIMIT=768MiB GOGC=50 node node_modules/typescript/bin/tsc --project experiments/tsconfig.bot-filters.json
node experiments/record-account-reaction-facts.mjs
```

The runtime loader freezes account-message.js, operations.js, gram-style.js,
client.js and adapters.js at 8da6cd7d11d0229bf02a3c3ba3372aebc465a544. The declaration
runner freezes index.d.ts and account-message-types.d.ts at that revision while
keeping the example unchanged. This advances R01/R02/R05/R17/R19. Full SDK parity,
remaining rich-message/model helpers, production-account verification and all
wider application/protocol criteria remain open in the main work plan.
