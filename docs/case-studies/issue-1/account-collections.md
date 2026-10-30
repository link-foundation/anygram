# Account collection counts

Both account facades now return message and dialog arrays with a writable,
enumerable `.total` count. Partial history and dialog responses retain the
server's count; complete responses use their raw vector length. Requested ID
collections count requested IDs, including missing-message placeholders. Counts
are independent of returned array length, client-side filtering and caller
mutation of earlier arrays. The latest dialog page supplies its count, matching
the pinned SDK collectors. Concurrent calls keep independent metadata.

The preceding shared operations discarded the history response envelope before
constructing account views. Dialog collection also discarded the page counts,
and zero-limit dialog collection made no request. A shared internal message-page
operation now retains the envelope. Canonical `getMessages` still unwraps its
plain array, while account collection uses the same RPCs and peer cache. The
existing bounded dialog iterator reports pages to its collector privately.
Canonical invocation and iterator data keep their existing shapes.

`getMessages(peer, { limit: 0 })` and `getDialogs({ limit: 0 })` request at most
one item once, retain the count, and return no items. Zero-limit iterators make
no request. Empty explicit-ID arrays return an empty counted array without a
lookup or RPC. Aborted empty requests still reject. Options and ID arrays are
snapshotted before asynchronous resolution; mutation after submission cannot
change the reported ID count. Malformed non-integer, negative, non-numeric or
out-of-range server counts reject instead of becoming pagination metadata.

The official [message slice](https://core.telegram.org/constructor/messages.messagesSlice),
[channel messages](https://core.telegram.org/constructor/messages.channelMessages)
and [dialog slice](https://core.telegram.org/constructor/messages.dialogsSlice)
contracts carry `count:int`. The message slice may mark results inexact; `.total`
retains the server count and does not promise an exact production census. The
primary documents are archived with SHA-256 digests beside the installed SDK
source inventory in [the research facts](data/account-collections.json).

## Reproduction and verification

```sh
node --loader ./experiments/account-collections-before-loader.mjs --test tests/account-collections.test.js
node --test tests/account-collections.test.js
bun test tests/account-collections.test.js
deno test --allow-read --allow-write --allow-env --allow-net=127.0.0.1 --allow-run=git tests/account-collections.test.js
node experiments/composer-fluency-check.mjs --account-collections --before
node experiments/composer-fluency-check.mjs --account-collections
```

All 65 focused cases pass on Node, Bun and Deno. Frozen preceding sources fail
64 and retain the existing canonical-shape guard. Actual GramJS and teleproto
collectors compare message history, explicit IDs and dialogs, including their
own result objects and metadata descriptors. Four further actual-SDK comparisons
record the zero-limit behavior: GramJS 2.26.22 treats zero as unlimited and loads
the supplied finite page; teleproto 1.232.0 already returns only its count. Each
oracle permits at most one invocation. Owned facades use the bounded count-only
behavior on both styles. No SDK or global registry is patched.

Ten selected-route cases cover native, GramJS, teleproto, mtcute and @mtproto/core
adapters. Two independent encrypted TCP cases each verify history, dialogs and
both count-only calls with exact origin hashes. Cancellation before dispatch and
after response, selected failures, concurrent calls, overlapping dialog pages,
missing entities, all message count-bearing constructors, not-modified results,
integer boundaries, detached arrays, mutable submission options and empty IDs
have explicit regressions. Canonical raw results retain their original shape.

The [public example](../../../examples/typed-account-collections.ts) verifies
required owned count types and rejected string assignments. The portable fixture
also compiles against both actual SDKs. Their declarations permit undefined
counts; the owned facade always initializes its count. The immutable preceding
declarations reproduce the missing public collection type and count properties.

An initial TCP fixture omitted the current message-slice `topics` vector; adding
the required empty vector repaired that test setup. An initial zero-limit oracle
incorrectly assumed teleproto shared the older GramJS defect; the actual SDK
comparison corrected that assumption. Static checks required extracting the
shared dialog page loader to retain the existing complexity threshold.

All 4,482 core cases pass on Node, Bun and Deno; the focused cases also pass
on Node 20. Strict static/generation checks and actual SDK compilation pass,
with 197 production sources and zero clones. All 71 framework cases pass on
Node 20/26, Bun and Deno; 27 native terminal, eight Node 20 wire, sixteen
fact-parser and bounded FIFO checks pass. Packaging contains 242 permitted files.
Deno auto-install altered npm dependency links and exposed a newer Prettier;
restoring the locked npm graph resolves that unrelated local tooling mismatch.

## Remaining scope

This implements message/dialog collection metadata through the existing shared
operations. Complete SDK history search/filter/reverse/pagination and scalar-ID
return conventions, other collection helpers, drafts, legacy integer methods,
historical schema bridges and refined account models remain open. Canonical
history retains its existing single-page contract. Production-account and wider
protocol/application acceptance criteria remain unverified. PR #2 remains draft
and unmerged until the complete issue is implemented and verified.
