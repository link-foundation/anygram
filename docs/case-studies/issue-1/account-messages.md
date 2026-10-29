# Client-bound account messages

[PR #2](https://github.com/link-foundation/anygram/pull/2) adds owned message
helpers to the detached GramJS and teleproto account views. Previously,
`(await client.gramjs.getMessages(peer))[0].reply({ message: 'Hello' })` failed
because the response contained fields without model methods. The same limitation
affected reply lookup, editing, deletion, forwarding, pinning, read receipts,
downloads and metadata access. The actual pinned SDK models provide the
comparison contracts, including their differences.

Message and service-message responses now have methods bound through private
WeakMaps to their owning style and selected client. The context is absent from
enumerable data and serialization. Canonical normalization copies response
fields, typed arrays and nested media, so changing a view leaves the original
backend response intact. Models share the existing bounded peer cache and RPC
operations. A matching request InputPeer remains a private per-message origin,
taking priority over missing or conflicting response entity hashes. Forwarded
and sent results retain their resolved destination; zero-length history does
not resolve an unused peer. They do not instantiate or bundle either SDK. A five-adapter
regression rejects use of an unselected adapter; encrypted native TCP verifies
reply, pin, read and delete requests with independently encoded server replies.

The implemented methods are `respond`, `reply`, `edit`, `delete`, `forwardTo`,
`downloadMedia`, `pin`, `unpin`, `markAsRead`, `getReplyMessage`, `getChat`,
`getInputChat`, `getSender`, `getInputSender` and `getEntitiesText`. Source peer
and sender IDs use native bigint, including marked chat/channel IDs. Common
media getters identify reusable photos/documents, webpage previews, audio,
voice, video, round video, GIFs, stickers, contacts, games, locations, invoices,
polls, venues and dice. File metadata exposes available names, MIME types,
dimensions, durations, titles, performers, sticker metadata and exact sizes.
Photo byte counts cover ordinary, cached, stripped, empty and progressive sizes.

Reply lookup first uses InputMessageReplyTo, preserving access to a replied
message by the current message's origin. One direct-ID fallback handles missing
or deleted origins. A successful reply is cached per message. Missing channel
hash lookup visits at most one dialog page with a limit of 100. Cached asynchronous
metadata reads and network mutations reject a pre-aborted signal. RPC failures retain
their type/backend and are not replayed as mutations against another adapter.
Missing message positions become undefined in getMessages; history iteration
skips those placeholders.

The two styles need separate contexts: the pinned GramJS message delete helper
defaults to keeping the other participant's copy, while teleproto defaults to
revoking it. Explicit revoke flags behave consistently. Both SDKs mutate reply
and edit option objects; the owned helpers copy those options. The implementation
maps explicit formatting entities, preview settings, raw reply markup and
schedules into shared request fields. Short sent responses retain explicit
FormattedText entities. Full update containers use random-ID correlation for
sends/forwards and source-peer/message-ID matching for edits. An unrelated
new-message update cannot become a sent result without its correlation.

Both pinned SDK document File implementations throw for width, height and
duration because they pass an array to instanceof. The owned implementation
reads matching document attributes instead. Regressions assert both the actual
SDK exception and the independently expected numeric metadata. Compact file IDs
remain explicitly unsupported, matching the pinned SDKs. Detached messages use
native bigint and Uint8Array values; they do not implement legacy integer
methods, vendor instanceof, or raw TL serialization methods.

The finite suite contains 101 new cases: 94 fail with the immutable preceding
source and all pass with the implementation. Six comparisons call the actual
SDK client helpers and compare complete serialized pin/unpin/read request
bytes. Other comparisons call actual message models, inspect their arguments,
compare metadata TL bytes and verify the reply lookup/cache sequence. The
[checked example](../../../examples/typed-account-messages.ts) produces ten
diagnostics with preceding declarations and passes with the new types, including
five negative argument checks. The [source inventory](data/account-messages.json)
records installed versions, source hashes, public member names and explicit
remaining differences.

```sh
node --loader ./experiments/account-messages-before-loader.mjs --test tests/account-message-models.test.js tests/account-message-metadata.test.js tests/account-message-boundaries.test.js tests/account-message-rpc.test.js
node --test tests/account-message-models.test.js tests/account-message-metadata.test.js tests/account-message-boundaries.test.js tests/account-message-rpc.test.js
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --account-messages --before
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --account-messages
node experiments/record-account-message-facts.mjs
```

The runtime loader freezes client.js, gram-style.js and operations.js at
8a37c45d45edeea94a62ed0afbaa1f4677fea151; the declaration runner freezes the public
index at the same revision. Tests and examples remain unchanged between runs.

Full custom-model parity remains unfinished. Button models/click interactions,
parseMode and rich text getter/setter behavior, forward/action-entity models,
sender refetch/input-from-message fallbacks, full send/edit file and album
shortcuts, toId/self and via-bot metadata still require implementation and
verification. The general facade sendMessage response contract is unchanged;
full cross-library result models and production Telegram account scenarios
remain open. This checkpoint advances R01/R02/R05/R17/R19 and does not satisfy
the wider issue by itself.
