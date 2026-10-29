# Requirements and acceptance evidence

All requirements remain open until their full scope is verified. An API name or
a mock alone does not demonstrate protocol or compatibility parity. The issue
has no required sub-issues at the initial snapshot. `data/issue.json` preserves
the complete original prose. New feedback must be incorporated here.

| ID  | Requirement                                                                              | Implementation / plan                                                                                                                          | Verification / current state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R01 | A unified API over GramJS, teleproto, mtcute, @mtproto/core and other popular JS clients | Shared request pipeline and optional adapters                                                                                                  | Shared routing and optional backend kinds; actual GramJS/teleproto corpus and mtcute writer comparisons pass. Complete operations/return parity is open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| R02 | Merge the feature union, with extended APIs for each library style                       | Preserve bound extended clients; canonical high-level operations plus raw schemas                                                              | Bound extended clients and shared raw/account/media/bot/formatting/session code exist. Full feature-union audit remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| R03 | Use existing libraries and implement their missing features                              | Backend capabilities and independent transports                                                                                                | Native Bot API, encrypted MTProto, authentication/QR/email/SRP, sessions, DCs, updates and media implemented. Secret chats/call media and remaining account flows are open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R04 | Apply the command-stream competitive methodology                                         | Pinned executable compatibility corpus, capability ledger, migration examples                                                                  | Pinned serializers and executable regressions follow the comparison method; command-stream README and immutable test-path inventory archived.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| R05 | Support every Telegram JS library feature                                                | Audit MTProto clients, Bot API frameworks, TDLib, sessions, media, dispatch, formatting, middleware, proxies and transports                    | 431 local tests cover current mechanisms, including SOCKS4/4a/5, MTProxy and native TLS WebSocket. Scene/wizard/session comparisons pass; full parser/plugin, TDLib semantics, other proxies and runtime parity remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R06 | Fully support the Telegram protocol                                                      | TL schema, auth key exchange, encrypted transport, API RPCs, service messages, DC migration, update recovery, secret chats and calls           | Layer 232, auth-key/envelopes, RPCs, migrations, ordered recovery and watched/idle scheduler tested. Four TCP framing formats and live anonymous encrypted TCP verified. Secret-chat TL, both envelope versions, sequences, deletion, DH primitives and layer/cutover policy tested. Native encrypted TCP tests cover initial handshakes, integrated layer/sequence/PFS, durable effects and qts ordering. Encrypted file upload/delivery/download/forwarding is tested through local native peers. Durable application services and ordered TTL defaults are tested; bounded read-triggered expiry and cache erasure are tested. Controlled production peers and calls remain open.                                                                                                                            |
| R07 | Survey popular clients in other languages and test coverage                              | Telethon, Pyrogram, TDLib, gotd/td, MadelineProto snapshots                                                                                    | Nineteen immutable test-path inventories and 32 complete report discussions archived. Path counts are not executed tests/coverage; full comparison remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| R08 | Most feature-rich solution and better practices                                          | Explicit comparison evidence, bounded resources, exact IDs, cancellation, deterministic shutdown, default-off diagnostics                      | Bounded queues/downloads/watch sets, finite HTTP bodies, exact IDs, cancellation and lifecycle regressions exist. Resource superiority and complete runtime support are unverified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| R09 | Public domain                                                                            | Unlicense for original implementation; external adapters remain optional and upstream licensed                                                 | Unlicense retained; npm dry run has 75 permitted entries and excludes research/optional dependencies. Upstream components retain their licenses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| R10 | All meta-sovereign needs                                                                 | Archive its Telegram source inventory and test account login, archives, read/send, media, Bot API, complete raw layer and application features | 333 pinned Telegram JS source/test files and literal API inventory archived. New peer/contact/profile/greeting helpers tested; complete scenario mapping and calls/business/stories coverage remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| R11 | All konard/telegram-bot needs                                                            | History export, media, visible users, contacts, sessions, graceful timeout handling                                                            | History, media-origin refresh, participants and contacts primitives tested; complete export/visible-user/contact-action scenario evidence remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| R12 | All konard/follow needs                                                                  | Public/private join, leave, dialogs, 2FA, sessions, mute/archive and raw operations                                                            | Shared bounded dialog pagination has actual GramJS/teleproto/mtcute and native TCP evidence, including peer-qualified messages and settings. Legacy/official chat links and layer-232 join caching now have failing-before and actual-client/native regressions. A bounded batch now covers existing/public/private membership, approval/verification, settings, history and leave with native/actual-client evidence. A shared owned connection scope now covers bounded disconnect/destroy retries and original-error preservation with actual-client/native evidence. Pinned application classes and a migrated CLI now cover bounded input/cache, login callbacks, portable persistence, settings, info/history and exact IDs. Legacy standalone compatibility and controlled-account evidence remain open. |
| R13 | All telegram-terminal-bot needs                                                          | grammY middleware, commands, edits, keyboards, text/photo/animation, updates, deterministic stop                                               | Middleware, commands, events, context edits/media and deterministic polling tested. Complete terminal bot scenario migration remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R14 | All telegram-community-posts needs                                                       | Node bot events, once/onText, keyboards, callbacks, channel send/delete and user-account search                                                | Legacy events/once/onText, callbacks and account search primitives tested. Complete community posting/deletion/search scenario remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R15 | Address competitors' top issues                                                          | Archive highest-comment open reports, read all selected comments, add regression cases for observed problems                                   | All comments on 32 selected reports read, with 26 inspected images; update receipt, album, file-reference, formatting, duplicate polling and membership regressions added. Remaining triage entries stay open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R16 | Multiple alternative APIs with deduplicated internals                                    | String, TL object, class request and namespace facades share one route                                                                         | Five raw styles tested; repaired zero-threshold clone gate scans all 70 production JS/TS files with zero clones                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| R17 | Execute all features through any backend or directly                                     | Capability routing and shared raw-based high-level implementations                                                                             | Shared high-level operations run on raw-capable adapters; protocol-specific capabilities are explicit. Full every-backend execution remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| R18 | User selects libraries or independent fallback when none available/enabled               | Explicit backend selection and optional lazy loading with native defaults                                                                      | Native defaults, disabled/missing optional libraries and portable GramJS construction/session persistence tested; other loader/session parity remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R19 | Support competitors' API styles with minimum migration changes                           | Constructors, parameters, returns, events and sessions audited against installed versions                                                      | Five request styles, nested composers, Telegraf command/context aliases, legacy events and actual StringSession interoperability tested. Constructors, complete returns and event models remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| R20 | Compile all research into docs/case-studies/issue-1                                      | Repeatable collector and raw snapshots, source URLs and capture timestamps                                                                     | Repeatable collectors, snapshots, complete selected discussions/images and immutable inventories are in data/; credentials/subscription links are redacted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R21 | Deep case-study analysis including additional online research                            | Primary documentation, issue evidence, library licenses and architecture alternatives                                                          | README.md analyzes reuse/licenses, protocol limits, downstream needs, all selected reports and CI causes with primary sources.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R22 | List every prose requirement and solution/plan per requirement                           | This inventory and plan.md                                                                                                                     | 24 prose requirements mapped here; plan.md tracks execution. No required sub-issues/comments at the refreshed snapshot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| R23 | Examine reusable existing components                                                     | Optional ecosystem adapters; native code for independently usable transport                                                                    | Case-study reuse matrix evaluates optional clients, TL oracles, TDLib, web primitives and bot plugins; original code is independently implemented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| R24 | Execute in one PR with nothing deferred                                                  | PR #2, forward-only commits, CI and evidence mapping                                                                                           | All work stays in PR #2 with forward commits. PR remains draft and unmerged while protocol, compatibility and scenario criteria are open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

The issue's unbounded superiority statements (R05–R08) require an explicit
versioned comparison set and evidence; they cannot be inferred from a raw-RPC
escape hatch. Bot API permissions do not grant user-account access. Full
MTProto RPC coverage does not establish secret-chat or voice-media support.

Latest R03/R06 checkpoint: the active `SecretChatSession` combines initial
credentials with layer/cipher/sequence policy and exact durable encrypted
retransmissions. Sixteen unit tests and a bilateral native TCP integration test
verify atomic message effects, qts acknowledgement ordering, restart, gaps,
downgrade aborts, deletion, budgets and private receipt ownership. All 279 tests
pass on Node, Bun and Deno; strict checks scan 57 production files with no
clones. The R09 package dry run has 62 permitted entries. Compulsory PFS,
encrypted media, controlled production peers and the other open criteria remain
unfinished.

The subsequent PFS action checkpoint passes 290 tests on each runtime and all
strict checks. Its state machine covers request/accept/commit/abort, signed
simultaneous exchanges, lost commits, cryptographic validation and usage/age
thresholds. Real encrypted service frames verify the key-installation boundary.
The clone scan covers 58 production files, and the package has 63 permitted
entries. Automatic integration and gap-aware previous-key erasure remain open.

The key-ring checkpoint adds seven regressions for authenticated candidate
selection, old-key retention through gaps, downgrade boundaries, portable
state, retained ciphertext and original visualization hashes. All 297 tests
pass on Node, Bun and Deno; strict checks scan 59 production files with no
clones. The ring owns at most two key generations and erases the previous one
after ordered proof. Automatic durable session integration remains open.

The integrated PFS checkpoint supersedes that limitation: original handshakes
provide DH parameters, and the active session automatically starts usage/age
rotations, resolves collisions, validates candidate proof and erases previous
keys after gaps close. Twelve new regressions bring each runtime to 309 passing
tests. Native TCP/update-manager integration covers bilateral rotation before
qts acknowledgement. Cross-rotation deletion retains prepared old-key
ciphertext rather than old keys. Legacy state migration, ciphertext integrity,
bounded observations and combined buffer limits are verified. Strict checks
scan 61 production files without clones; the package has 66 permitted entries.
Encrypted media, controlled production interoperability and all other unmet
criteria remain open. Key-ring head 21f5873 passed every applicable gate and
all nine runtime/OS jobs in CI run 40809723730; this checkpoint needs fresh CI.

Initial key creation timestamps now survive credentials, delayed active-session
creation and protected restart. The failing-before regression brings each
runtime to 310 passing tests with strict checks. Integrated PFS e793a71 passed
all nine runtime/OS jobs and applicable gates in run 40812109787. Encrypted
media and production interoperability remain open.

Encrypted file transfer adds nine regressions after three failing-before API
checks. Uploads use independent random keys/IVs, continuous AES-IGE across
bounded parts, ciphertext checksums and the big-file path above 10 MiB.
Downloads validate metadata/fingerprints and declared byte limits, use the
file's DC, reject truncated/oversized/redirected chunks and strip only final
padding. Cancellation, early iterator closure, owned key material, Blob/path
sources and unchanged caller buffers have coverage. An independent GramJS IGE
decryptor verifies ciphertext. Shared cloud upload behavior remains covered.

All 319 tests pass on Node, Bun and Deno; strict lint, formatting, full types
and the zero-clone scan of 63 production files pass. The package dry run has
68 permitted entries. Key-age head d409008 passed every applicable CI gate and
all nine runtime/OS jobs in run 40812653369. Durable attachment submission and
incoming gap persistence remain open, as do controlled production peers and
the wider issue requirements.

Durable attachment submission and incoming gap persistence now have nine unit
regressions and a bilateral encrypted TCP test. The session persists uploaded
or reusable file references with exact ciphertext before submission, validates
returned references before saving submitted state and commits file effects
atomically. Restored gaps retain references until ordered delivery. References
count toward buffer limits and are removed from replacement deletions. Canonical
reference digests reject inconsistent protected snapshots. Two failing-before
checks caught the legacy layer's 32-bit document size and undetected incoming
reference corruption; both now pass. Photo, video, audio, document, reusable
and big-upload references have coverage.

All 329 tests pass on Node, Bun and Deno. Strict checks pass with zero clones
across 64 production sources; the npm dry run has 72 permitted entries. The typed
attachment example compiles. Standalone transfer head 56cfb79 passed every
applicable gate and all nine OS/runtime jobs in
[run 40813667642](https://github.com/link-foundation/anygram/actions/runs/40813667642),
created 2026-10-29T03:42:36Z and completed 2026-10-29T03:44:52Z. Fresh CI is
required for durable attachments. Issue comments, sub-issues and all three PR
feedback streams remain empty; current main is an ancestor of the branch.

Secret-chat service/TTL behavior and controlled production peer interoperability
remain open, along with call media, runtime, compatibility and downstream
scenario criteria. Local peers do not establish production interoperability.

Application service checkpoint: `queueService` now durably submits read, delete,
screenshot, history-clear, typing and TTL actions. ID vectors preserve signed
64-bit values and are copied, deduplicated and bounded. Ordered TTL settings
survive JSON restart and failed saves leave both defaults and ciphertext
unchanged. Omitted message TTL uses the current default; explicit zero disables
expiry and explicit positive message values retain the TL integer range.
Invalid incoming chat defaults follow official Android clamping to one year.
Batch deletion and history clearing replace unacknowledged message/attachment
frames while preserving their original sequence and encryption boundaries.

Eight new service regressions, a low-level capacity regression and a bilateral
attachment-deletion regression bring Node, Bun and Deno to 339 passing tests.
The native encrypted TCP file scenario also exchanges TTL and read services
through real update-manager persistence before qts acknowledgement. Strict lint,
formatting, full types and the zero-clone scan of 65 production sources pass;
the package dry run has 72 permitted entries. The typed service example compiles.
Failing-before logs preserve attachment retention during deletion and rejection
of a valid explicit message TTL above the chat-default maximum.

Durable attachment head 8d9027e passed all nine OS/runtime jobs and applicable
gates in [run 40815695308](https://github.com/link-foundation/anygram/actions/runs/40815695308),
created 2026-10-29T04:04:46Z and completed 2026-10-29T04:06:42Z. Fresh CI is
required for this service checkpoint. Read-triggered expiry and application
history deletion still need implementation evidence. Controlled production
accounts, call media, complete compatibility and downstream criteria remain open.

Read-triggered expiry checkpoint: `SecretChatLifetimes` retains bounded metadata
for expiring messages without plaintext or file keys. History reads and explicit
content opening have separate triggers; repeated reads keep the first deadline.
Audio/video playback duration sets a minimum lifetime. Portable state retains
exact signed IDs and validates bounds, duplicate records and malformed clocks.
Incoming read/delete/history services update the metadata only after ordered
authenticated delivery. Applications delete their actual stored history in the
same transaction as timer/session state; the typed example includes batched
durable deletion and a single shared scheduler callback.

A failing-before retention regression showed that application deletion left
acknowledged protocol plaintext and ciphertext cached. Delete/history actions now
prune acknowledged frames and their associated packets/file references, while
unacknowledged originals retain self-deletion sequence positions. The explicit
`pruneAcknowledged` method uses mandatory durable persistence and preserves all
protocol counters. Failed saves retain the old state.

Ten new tests cover exact deadlines, restart, direction, protected media,
playback duration, complete vector validation, bounded snapshots, immutable
metadata, read timestamp ordering and actual session save rollback. All 349 tests pass on Node, Bun and Deno. Strict lint, formatting, full
declaration/example checks and the zero-clone scan of 67 production sources
pass; the package dry run contains 72 permitted entries. Fresh CI is required
for this checkpoint. Controlled production interoperability and all
other unmet issue criteria remain open.

Server-date persistence checkpoint: successful encrypted RPC saves now include
`effects.sent` with the exact outgoing body, random ID, sequence and server date.
Applications commit these with submitted state and history; failed saves keep
exact ciphertext available for retry. Incoming `receive({ date })` metadata
survives out-of-order delivery, duplicate updates and protected JSON restart.
The first accepted date stays attached to its frame; ordered effects expose it
before qts acknowledgement. Pending date metadata counts toward the combined
buffer limit and snapshot digests reject mismatched frame/date tuples. Older
snapshots without dates retain `undefined` rather than inventing history times.

Six failing-before regressions cover outgoing receipts, failed persistence,
restart, gap closure, duplicate dates, malformed snapshots and timer integration.
The bilateral native TCP attachment scenario checks outgoing and incoming dates;
the existing combined-budget test includes buffered dates. All 355 tests pass on
Node, Bun and Deno, with strict lint, formatting, full types and zero clones
across 68 production sources. The package dry run contains 73 permitted entries.
Fresh CI is required for this checkpoint. Controlled production peer results and
all remaining feature-union, runtime, call-media and downstream criteria stay open.

Phone-code delivery checkpoint: `onCode(challenge)` receives a copied server
challenge before phone/email prompts. Applications can continue, explicitly
request the advertised next method, or cancel the current code remotely.
Resends retain the current hash and subsequent sign-in uses the newly returned
hash. They share the finite login-step bound. Callback cancellation and server
failures propagate without replay; no session is saved for cancellation or a
malformed authorization result. The application owns timeout-aware UI decisions.

Seven failing-before regressions cover hash ownership, resend success, current
code cancellation, email/Firebase fallback selection, malformed actions,
challenge limits, cancellation and server errors. A separate failing-before
regression catches session persistence before a malformed success is rejected.
A bounded native encrypted TCP test executes both the successful and cancelled
flows, and request bytes match actual pinned teleproto. All 364 tests pass on
Node, Bun and Deno, with strict lint, formatting, full types and zero clones
across 68 production sources; the npm dry run contains 73 permitted entries.
The typed delivery example compiles. Fresh CI is required for this checkpoint.

All 374 tests pass on Node, Bun and Deno. Strict lint, formatting, full types
and the zero-clone scan of 69 production sources pass; the npm dry run contains
74 permitted entries. The ten added dialog tests include failing-before API,
consumer-ownership and inherited teleproto constructor-tag regressions.
Phone-code head 7f5b144 passed all nine OS/runtime jobs and applicable gates in
[run 40820313069](https://github.com/link-foundation/anygram/actions/runs/40820313069),
created 2026-10-29T04:54:07Z and completed 2026-10-29T04:57:05Z. A fresh run is
required for this dialog checkpoint. All other unmet criteria remain open.

Chat-link and join checkpoint: thirteen failing-before regressions expose missing
legacy invite support, unanchored host matching, lost nested join entities and
cancellation failing to stop the join after username resolution. The shared chat
parser handles official HTTP aliases, username subdomains, tg forms and exact
message/thread/channel IDs. It rejects unsupported routes and malformed or
ambiguous targets. Configured extra hosts can be parsed explicitly. Numeric phone
links use contacts.resolvePhone; private message links require an existing access
hash and report INVITE_REQUIRED when used to join. No access hash is invented.

Layer-232 messages.chatInviteJoinResultOk replies retain their public wrapper
while their nested update entities enter the bounded peer cache. Old Updates
responses remain supported. Approval errors, expired invites, flood waits and
verification-required replies propagate without replay or fabricated membership.
Request signals now reach shared peer lookup, and an abort between lookup and a
side effect stops that side effect before RPC invocation.

All 388 tests pass on Node, Bun and Deno, including actual GramJS/teleproto
request and response objects and an encrypted native TCP private join followed
by mute/archive. Strict lint, formatting, full types and the zero-clone scan of
70 production sources pass; the package dry run has 75 permitted entries. The
chat-link example compiles. data/chat-link-sources.json preserves the primary
link/join sources with SHA-256 digests. Their public method pages still describe
the older Updates return; the pinned layer-232 schema and teleproto serializer
provide the new wrapper's wire evidence. This is not a claim that verification
has completed or that a pending approval has granted membership.

Dialog head fdaefb0 passed all nine OS/runtime CI jobs and applicable gates in
[run 40821882974](https://github.com/link-foundation/anygram/actions/runs/40821882974),
created 2026-10-29T05:10:47Z and completed 2026-10-29T05:13:43Z. Fresh CI is
required for the chat-link checkpoint. Full follow scenarios, complete migration,
controlled accounts, calls, remaining backends/runtimes and all other unmet
requirements remain open. Issue comments and all three PR feedback streams were
refreshed after the dialog commit and remain empty.

Invite inspection and follow workflow checkpoint: shared `checkChatInvite`
inspects without joining and caches exact already-member/preview entities.
`getNotifySettings` accepts peers and canonical notification scopes. `muteChat`
now preserves explicit false flags, unmute timestamps, sounds and story settings;
nested preferences are owned before asynchronous peer lookup. Public declarations
and the typed chat-link example cover the new methods and settings.

`examples/follow-groups.js` executes a complete bounded batch over the shared
client: dialog membership indexing, public aliases, private invite preflight and
post-join confirmation, approval/verification outcomes, mute/archive, listing,
recent history and leave. Settings target the confirmed peer, never an arbitrary
chat included in updates. Accepted membership and completed settings remain
visible when a later operation fails. The default stops on flood waits; an
explicit continuation processes later destinations without replaying or sleeping.
Capacity errors always stop. Caller mutations cannot expand a validated batch
beyond 1000 links or change its requested settings while membership is loading.

Nineteen new regressions include failing-before missing helpers, nested settings
ownership, duplicate alias joins, malformed preflight and mutable batch bounds.
Actual GramJS/teleproto constructors and replies, independent mtcute writer bytes,
and encrypted native TCP cover invite confirmation and settings. A native test
includes unrelated join-result chats and verifies the final settings peer.
All 407 tests pass on Node, Bun and Deno, with strict lint, formatting, full types,
zero clones across 71 production sources and 76 permitted package entries.

Chat-link head b3a8f18 passed all nine runtime/OS jobs and applicable gates in
[run 40822942152](https://github.com/link-foundation/anygram/actions/runs/40822942152),
created 2026-10-29T05:21:39Z and completed 2026-10-29T05:23:24Z. Fresh CI is
required for this workflow checkpoint. Follow's full wrapper/CLI migration,
connection cleanup and controlled-account evidence remain open, together with
all other unmet criteria. The latest issue/sub-issue inventory and all three
PR feedback streams are empty. Main remains an ancestor of the branch.

Connection ownership checkpoint: `Anygram.withConnection` pins the callback to
one selected backend, runs connection/login and application work once, and awaits
`disconnect` followed by `destroy` when supported. Each cleanup stage has at most
three attempts; its delay is validated and bounded. Cancellation stops setup or
the application's operations without skipping cleanup. Overlapping scopes for
the same raw backend reject before resource creation. A backend with no cleanup
capability is rejected before connecting.

Exhausted cleanup stages raise an AggregateError containing every failed attempt
with the original cause. When application work also failed, that exact failure
is retained first and as the aggregate cause, rather than being overwritten by a
finally block. Successful cleanup retries preserve the callback result. A failed
destruction stage remains explicit even when disconnect succeeded. Destruction
may permanently close a backend; later independent scopes need a fresh client.
The policy addresses the retry/all-causes requirement in the immutable
[follow cleanup review](https://github.com/konard/follow/pull/9#issuecomment-3465820163).

Eighteen regressions cover failing-before missing scopes and dropped login
request options, partial setup, result/error ownership, cancellation, stage bounds,
asynchronous completion, diagnostics and concurrent ownership. Actual GramJS and
teleproto clients execute their real destruction methods; an encrypted native
TCP test verifies the socket is closed before returning its RPC result. The typed
account scope checks callback inference, login options and dialog iteration.
All 425 tests pass on Node, Bun and Deno, with strict lint, formatting, full types,
zero clones across 72 production sources and 77 permitted package entries.

Follow-workflow head 5baa0c3 passed all nine runtime/OS jobs and applicable gates
in [run 40824428315](https://github.com/link-foundation/anygram/actions/runs/40824428315),
created 2026-10-29T05:37:03Z and completed 2026-10-29T05:39:34Z. Fresh CI is
required for this connection checkpoint. Full downstream wrapper/CLI migration,
controlled-account scenarios and every other unmet requirement remain open.

## Fixed-width request migration checkpoint

Actual GramJS/teleproto objects exposed two independent request-path gaps:
`ReqPqMulti`/`PQInnerData` class names did not resolve to underscored protocol
names, and legacy/native big integers remained scalars where native/mtcute
writers require fixed-width bytes. Six failing-before regressions reproduce
these failures with the actual client constructors. A further assertion caught
optional `int256` fields not being converted back to teleproto big integers.

Schema-derived aliases now preserve protocol acronyms and underscores in both
directions. One shared fixed-integer encoder preserves signed values and
unsigned nonce bit patterns, rejects overflow and JavaScript numbers, and keeps
decoded fields as owned little-endian byte arrays. It handles both required and
optional fields. Tests include high-bit 128/256-bit values, signed boundaries,
legacy GramJS big integers and actual mtcute group-call request serialization.
This verifies request bytes, not call-media operation.

The complete schema corpus now compares both canonical-to-client and
client-to-native encoding. Resolving the protocol names adds 43 layouts per
client: 2,623 teleproto and 1,931 GramJS comparisons, alongside all 869 methods
and 1,758 non-Bool constructors. All 431 tests pass on Node, Bun and Deno.
Strict lint, formatting, full types and zero clones across 72 production sources
pass; the npm dry run contains 77 permitted entries.

Connection-scope head 29e780e passed all nine runtime/OS jobs and applicable
gates in [run 40825860170](https://github.com/link-foundation/anygram/actions/runs/40825860170),
created 2026-10-29T05:52:15Z and completed 2026-10-29T05:54:03Z. Fresh CI is
required for this compatibility checkpoint. Full return/event/style parity,
follow wrapper/CLI migration and all other open requirements remain unfinished.

## Account style data checkpoint

Eight migration regressions cover detached camelCase TL views, exact marked peer
IDs, peer-qualified top messages, folder/unread fields and group flags. The views
match actual GramJS and teleproto Dialog objects. Actual backend request classes
exercise overlapping paginated pages; cancellation stops between yielded dialogs.
An encrypted native TCP scenario returns the same data fields. The initial five
tests failed because these facade helpers were absent. Entity/history helpers
share canonical operations and preserve raw response objects.

All 439 tests pass on Node, Bun and Deno. Strict lint, formatting, full declaration
and typed example checks pass; the clone detector scans 73 production sources
with zero clones and the package dry run contains 78 permitted entries.
Vendor custom methods, drafts, array totals, legacy integer methods and instanceof
behavior remain available through the original backend, and are not implemented
by these plain data views. Full return/event/style parity and follow wrapper/CLI
migration remain open, alongside all other unmet requirements.

Fixed-integer head 036fa35 passed every applicable gate and all nine runtime/OS
jobs in [run 40826739905](https://github.com/link-foundation/anygram/actions/runs/40826739905).
Fresh CI is required for the account-style checkpoint.

## Pinned follow application checkpoint

The FollowClient example bridges configured account scopes to follow's application
helper names. It normalizes vendor/native responses before unwrapping layer-232
join results, preserves complete notification fields and qualifies cached dialog
identity by peer kind and exact ID. Connection cancellation remains active when
callers provide another signal; notification failures and exhausted cleanup
causes propagate. Login callbacks and session storage use the shared factory
and scope, rather than another connection or persistence implementation.

Eight regressions execute both pinned application classes without rewriting their
business logic. The batch covers existing/new public groups, private invites,
approval, private message access, invalid hosts, mute and archive over actual
GramJS/teleproto request and response constructors and native encrypted TCP.
The join/list/leave class runs against shared operations, including basic-chat
leave. Source hashes are checked before class extraction; CLI startup/imports
are excluded and pacing is bounded/omitted. Separate failing-before assertions
catch rounded numeric IDs and an overridden connection cancellation signal.

All 447 tests pass on Node, Bun and Deno, with strict checks and zero clones
across 73 production sources. The package dry run remains 78 permitted entries.
Account-style head 821d810 passed all nine runtime/OS jobs and gates in
[run 40828227547](https://github.com/link-foundation/anygram/actions/runs/40828227547),
created 2026-10-29T06:16:33Z and completed 2026-10-29T06:18:22Z.
Fresh CI is required for this bridge checkpoint. CLI arguments/Links Notation,
cache input, prompts, standalone connection/session compatibility and controlled
accounts remain open. The archived CLI's missing info/message methods and unsafe
numeric private-link conversion need explicit migration; these tests do not
claim those paths. All other unmet issue criteria remain unfinished.

## Follow command and login checkpoint

The command example retains follow's positional/named Links Notation, cached
telegram-links.lino input, join/list/leave commands and existing option aliases.
It uses the pinned links-notation 0.12.0 and yargs 17.7.2 as development-only
dependencies; the published library still has no runtime dependencies. The two
additional archived input helpers retain their original bytes and SHA-256 hashes.
The upstream HEAD remains af8fbb80cec26a7b5b205c93314372d1d92cec1f.

Thirty-three regressions cover bounded UTF-8 input, all multiline rows, exact URL
schemes, pending-stream cancellation, argument validation, mute/archive, approval,
flood stopping/continuation, info/history, exact private-channel IDs, and marked
list IDs usable by leave. Failing-before tests demonstrate that the pinned parser
treats URL schemes as labels, input cancellation can wait forever for another
chunk, and a batch without pacing advances before cancellation. The command
does not replay joins or suppress exhausted TIMEOUT cleanup. JSON output follows
successful cleanup, while default-off diagnostics contain request metadata only.

Existing plaintext follow environment keys and lazy phone/code/password prompts
feed the shared factory. Prompt echo tests verify secret suppression, cancellation
and EOF cleanup. Explicit environment values override the file without mutating
process environment. The shared atomic FileSessionStore saves an authorized
session before work; write failures prevent work and still clean up. This
deliberately uses a separate portable session file instead of rewriting .env,
and saved sessions take precedence over an imported legacy environment session.
Actual GramJS/teleproto clients verify construction and exported session bytes
with stubbed login/cleanup. Native encrypted TCP verifies authorized session
persistence and separately parsed join/history commands.

All 480 tests pass on Node, Bun and Deno. Strict lint, formatting, declaration and
typed-example checks pass, with zero clones across 73 production sources.
The preceding bridge head c55c44a passed all nine runtime/OS jobs and applicable
gates in [run 40829426170](https://github.com/link-foundation/anygram/actions/runs/40829426170),
created 2026-10-29T06:28:34Z and completed 2026-10-29T06:30:51Z.
Fresh CI is required for this command checkpoint. Legacy standalone connection/
constructor/session compatibility, controlled-account login and actual Telegram
application behavior remain open. This local command does not establish complete
downstream or backend parity, and all other unmet issue criteria remain unfinished.
