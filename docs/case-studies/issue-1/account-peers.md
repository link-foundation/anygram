# Account peer metadata and recovery

[PR #2](https://github.com/link-foundation/anygram/pull/2) adds shared forward,
via-bot, action-entity and destination metadata to the bound account message
models. Before this change, those properties were absent, missing senders never
reloaded and cached reduced entities could be used with unsuitable access hashes.
Both pinned SDKs provide comparison models; Telegram's constructor documentation
supplies the cache and input-peer rules.

`forward` retains the detached `originalFwd` header and exposes chat/sender IDs,
entities, input peers and async getters. User forwards identify a sender;
chat/channel forwards identify a chat. Hidden origins retain their display name
without inventing an identity. The owning client stays in a private WeakMap.
`viaBot`, `viaInputBot`, `actionEntities` and `toId` use the same canonical cache.
Service action lists retain undefined positions for unavailable entities. Incoming
private destinations remain undefined until the current self user is known.

The published SDKs both classify an invite-link inviter as a channel. The owned
lookup uses a user, as specified by the official
[inviter contract](https://core.telegram.org/constructor/messageActionChatJoinedByLink).
Tests retain the actual SDK's missing lookup alongside the corrected user result.
Both SDK Forward declarations also omit their runtime `originalFwd` property;
the owned public interface declares it explicitly.

A missing input sender triggers at most one source-message reload per view.
Concurrent calls share that request. A recovered entity replaces the missing
input; otherwise, a known source message supplies an `inputPeer*FromMessage`
fallback. Cached reduced entities can use that context immediately. Fetching
their complete metadata sends `inputUserFromMessage` or `inputChannelFromMessage`.
Cancellation is checked before cached reads and after awaited recovery, and RPC
errors retain their selected backend without automatic replay.

Telegram's [min-constructor rules](https://core.telegram.org/api/min) require
associating reduced peers with the message where they appeared. Senders, forward
headers and explicit user mentions now retain bounded contexts from both account
views and raw response/update containers. Each bound message prefers its own
source over the latest shared context. Channel ID lookup, deletion and read
receipts accept the corresponding source-message constructor too.

The [user contract](https://core.telegram.org/constructor/user) protects complete
identity and contact fields from reduced updates. The cache also applies its
photo/status conditions and records whether a hash remains restricted, including
the explicit empty-phone exception. The
[channel contract](https://core.telegram.org/constructor/channel) defines which
fields reduced updates may replace or clear; complete hashes and other rights
remain available. Tests cover every documented mutable channel field. The pinned
schema names `slowmode_enabled` and `verified` correspond to the documentation's
`slow_mode_enabled` and `is_verified` labels. Username replacement removes stale
aliases, and an unusable cached username can still resolve through Telegram.

The default cache bounds are 10,000 peer entries and 10,000 message contexts;
each bound view retains at most four resolved inputs. Missing chat lookup visits
one dialog page of at most 100 entries. These remain in-memory caches. Persistent
peer databases, bot-specific zero-hash exceptions and userFull cache invalidation
remain open, as do controlled production-account verification and full SDK parity.

The finite suite has 131 cases. Frozen preceding source fails 124 and passes seven
unchanged behaviors; the implementation passes all cases. Four comparisons use
actual SDK input constructors and complete serialized lookup bytes. User/channel
refreshes run through all five selected adapters and independent encrypted native
TCP. Eight preceding declaration diagnostics reproduce missing public contracts;
the checked example and actual SDK fixtures compile with the new declarations.
The [source inventory](data/account-peers.json) records package versions, hashes,
official source hashes, constructor fields, evidence and remaining limits.

All 2,716 core tests pass on Node, Bun and Deno. The 71 installed-framework cases
pass per runtime, alongside 27 native terminal cases, eight Node 20 wire cases,
sixteen fact-parser checks and the bounded FIFO experiment. Strict checks cover
176 production sources with zero clones; the package contains 219 permitted
entries. These checks verify the finite implementation without establishing the
remaining production-account or complete ecosystem criteria.

```sh
node --loader ./experiments/account-peers-before-loader.mjs --test tests/account-peer*.test.js tests/peer-cache.test.js
node --test tests/account-peer*.test.js tests/peer-cache.test.js
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --account-peers --before
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --account-peers
GOMEMLIMIT=768MiB GOGC=50 node node_modules/typescript/bin/tsc --project experiments/tsconfig.bot-filters.json
node experiments/record-account-peer-facts.mjs
```

The runtime loader freezes account-message.js, gram-style.js and operations.js at
1d5a564b133afa3e33ac22200f3caa29a219fa0a. The declaration runner freezes the public
index and account-message declarations at that revision. Tests and examples stay
unchanged between runs. This advances R01/R02/R05/R17/R19; rich formatting,
remaining custom model shortcuts and wider application/protocol criteria continue
in the main work plan.
