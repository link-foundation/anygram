# Requirements and acceptance evidence

All requirements remain open until their full scope is verified. An API name or
a mock alone does not demonstrate protocol or compatibility parity. The issue
has no required sub-issues at the initial snapshot. `data/issue.json` preserves
the complete original prose. New feedback must be incorporated here.

| ID  | Requirement                                                                              | Implementation / plan                                                                                                                          | Verification / current state                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| --- | ---------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| R01 | A unified API over GramJS, teleproto, mtcute, @mtproto/core and other popular JS clients | Shared request pipeline and optional adapters                                                                                                  | Shared routing and optional backend kinds; actual GramJS/teleproto corpus and mtcute writer comparisons pass. Complete operations/return parity is open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| R02 | Merge the feature union, with extended APIs for each library style                       | Preserve bound extended clients; canonical high-level operations plus raw schemas                                                              | Bound extended clients and shared raw/account/media/bot/formatting/session code exist. Full feature-union audit remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| R03 | Use existing libraries and implement their missing features                              | Backend capabilities and independent transports                                                                                                | Native Bot API, encrypted MTProto, authentication/QR/email/SRP, sessions, DCs, updates and media implemented. Secret chats/call media and remaining account flows are open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| R04 | Apply the command-stream competitive methodology                                         | Pinned executable compatibility corpus, capability ledger, migration examples                                                                  | Pinned serializers and executable regressions follow the comparison method; command-stream README and immutable test-path inventory archived.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| R05 | Support every Telegram JS library feature                                                | Audit MTProto clients, Bot API frameworks, TDLib, sessions, media, dispatch, formatting, middleware, proxies and transports                    | 349 local tests cover current mechanisms, including SOCKS4/4a/5, MTProxy and native TLS WebSocket. Scene/wizard/session comparisons pass; full parser/plugin, TDLib semantics, other proxies and runtime parity remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| R06 | Fully support the Telegram protocol                                                      | TL schema, auth key exchange, encrypted transport, API RPCs, service messages, DC migration, update recovery, secret chats and calls           | Layer 232, auth-key/envelopes, RPCs, migrations, ordered recovery and watched/idle scheduler tested. Four TCP framing formats and live anonymous encrypted TCP verified. Secret-chat TL, both envelope versions, sequences, deletion, DH primitives and layer/cutover policy tested. Native encrypted TCP tests cover initial handshakes, integrated layer/sequence/PFS, durable effects and qts ordering. Encrypted file upload/delivery/download/forwarding is tested through local native peers. Durable application services and ordered TTL defaults are tested; bounded read-triggered expiry and cache erasure are tested. Controlled production peers and calls remain open. |
| R07 | Survey popular clients in other languages and test coverage                              | Telethon, Pyrogram, TDLib, gotd/td, MadelineProto snapshots                                                                                    | Nineteen immutable test-path inventories and 32 complete report discussions archived. Path counts are not executed tests/coverage; full comparison remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R08 | Most feature-rich solution and better practices                                          | Explicit comparison evidence, bounded resources, exact IDs, cancellation, deterministic shutdown, default-off diagnostics                      | Bounded queues/downloads/watch sets, finite HTTP bodies, exact IDs, cancellation and lifecycle regressions exist. Resource superiority and complete runtime support are unverified.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| R09 | Public domain                                                                            | Unlicense for original implementation; external adapters remain optional and upstream licensed                                                 | Unlicense retained; npm dry run has 72 permitted entries and excludes research/optional dependencies. Upstream components retain their licenses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| R10 | All meta-sovereign needs                                                                 | Archive its Telegram source inventory and test account login, archives, read/send, media, Bot API, complete raw layer and application features | 333 pinned Telegram JS source/test files and literal API inventory archived. New peer/contact/profile/greeting helpers tested; complete scenario mapping and calls/business/stories coverage remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| R11 | All konard/telegram-bot needs                                                            | History export, media, visible users, contacts, sessions, graceful timeout handling                                                            | History, media-origin refresh, participants and contacts primitives tested; complete export/visible-user/contact-action scenario evidence remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| R12 | All konard/follow needs                                                                  | Public/private join, leave, dialogs, 2FA, sessions, mute/archive and raw operations                                                            | Public/private join, leave, archive/mute and session/2FA primitives exist; actual application scenario matrix remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| R13 | All telegram-terminal-bot needs                                                          | grammY middleware, commands, edits, keyboards, text/photo/animation, updates, deterministic stop                                               | Middleware, commands, events, context edits/media and deterministic polling tested. Complete terminal bot scenario migration remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| R14 | All telegram-community-posts needs                                                       | Node bot events, once/onText, keyboards, callbacks, channel send/delete and user-account search                                                | Legacy events/once/onText, callbacks and account search primitives tested. Complete community posting/deletion/search scenario remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| R15 | Address competitors' top issues                                                          | Archive highest-comment open reports, read all selected comments, add regression cases for observed problems                                   | All comments on 32 selected reports read, with 26 inspected images; update receipt, album, file-reference, formatting, duplicate polling and membership regressions added. Remaining triage entries stay open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| R16 | Multiple alternative APIs with deduplicated internals                                    | String, TL object, class request and namespace facades share one route                                                                         | Five raw styles tested; repaired zero-threshold clone gate scans all 67 production JS/TS files with zero clones                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| R17 | Execute all features through any backend or directly                                     | Capability routing and shared raw-based high-level implementations                                                                             | Shared high-level operations run on raw-capable adapters; protocol-specific capabilities are explicit. Full every-backend execution remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| R18 | User selects libraries or independent fallback when none available/enabled               | Explicit backend selection and optional lazy loading with native defaults                                                                      | Native defaults, disabled/missing optional libraries and portable GramJS construction/session persistence tested; other loader/session parity remains open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| R19 | Support competitors' API styles with minimum migration changes                           | Constructors, parameters, returns, events and sessions audited against installed versions                                                      | Five request styles, nested composers, Telegraf command/context aliases, legacy events and actual StringSession interoperability tested. Constructors, complete returns and event models remain open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| R20 | Compile all research into docs/case-studies/issue-1                                      | Repeatable collector and raw snapshots, source URLs and capture timestamps                                                                     | Repeatable collectors, snapshots, complete selected discussions/images and immutable inventories are in data/; credentials/subscription links are redacted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| R21 | Deep case-study analysis including additional online research                            | Primary documentation, issue evidence, library licenses and architecture alternatives                                                          | README.md analyzes reuse/licenses, protocol limits, downstream needs, all selected reports and CI causes with primary sources.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| R22 | List every prose requirement and solution/plan per requirement                           | This inventory and plan.md                                                                                                                     | 24 prose requirements mapped here; plan.md tracks execution. No required sub-issues/comments at the refreshed snapshot.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| R23 | Examine reusable existing components                                                     | Optional ecosystem adapters; native code for independently usable transport                                                                    | Case-study reuse matrix evaluates optional clients, TL oracles, TDLib, web primitives and bot plugins; original code is independently implemented.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| R24 | Execute in one PR with nothing deferred                                                  | PR #2, forward-only commits, CI and evidence mapping                                                                                           | All work stays in PR #2 with forward commits. PR remains draft and unmerged while protocol, compatibility and scenario criteria are open.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |

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
