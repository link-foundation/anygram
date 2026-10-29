# Issue #1 execution plan

Objective: implement and verify every issue requirement in PR #2, including the
widest requested protocol, compatibility, and downstream-project scope. Keep
unverified criteria open; passing CI alone does not establish protocol parity.

1. [x] Read the entire issue, issue comments, sub-issue inventory, and all three
       PR feedback streams. There are currently no comments or sub-issues.
2. [x] Inspect the template, release pipeline, tests, and repository guidance.
3. [x] Archive primary-source research on JavaScript and other-language clients,
       top competitor issues, command-stream, and all five downstream projects.
4. [x] Inventory every requirement and map implementation and verification.
5. [ ] Write failing, minimal tests for unified routing, backend selection,
       compatibility styles, native operation, and error handling.
6. [x] Implement the shared operation pipeline and optional adapters without
       silently replaying side effects or conflating unsupported and failed calls.
7. [ ] Implement native Bot API and MTProto protocol coverage, authentication,
       sessions, updates, media, and high-level operations.
8. [ ] Implement and test migration surfaces and extended APIs, comparing actual
       pinned competitor libraries rather than relying solely on mocks.
9. [ ] Cover downstream use cases and high-priority competitor failures with
       executable examples and regressions.
10. [ ] Publish public-domain documentation, API declarations, release changeset,
        capability matrix, and case study with evidence and remaining limits.
11. [ ] Run focused tests then all Node/Bun/Deno tests and local CI checks; keep
        large output in ci-logs, run memory-heavy work sequentially, and bound probes.
12. [x] Commit useful atomic changes on issue-1-1052f45c2e5e after checks pass.
13. [ ] Fetch/merge main, review the complete PR diff and preserve all features.
14. [ ] Push only the prepared branch; replace PR #2 title/body and retain Fixes #1.
15. [ ] Check recent CI timestamps/SHAs; download and read every failed run log,
        fix root causes, and verify all checks on the latest commit.
16. [ ] Verify requirement evidence, clean git status, and mark PR #2 ready only
        when all requested work is implemented and verified. Keep the PR unmerged.

Experiments belong in experiments/; reusable application scenarios belong in
examples/. No live credentials or sessions may be included in research data.

## Completed checkpoints

- Routing/native Bot API, schema/encrypted MTProto, authentication/SRP/sessions,
  and shared media/DC/update operations were committed independently with tests.
- Album finalization and omitted live-update recovery have failing-before/passing-
  after regressions derived from complete competitor discussions.
- Bounded QR/DC login, handler failure propagation, pagination validation and
  actual GramJS factory/session interoperability were committed and verified.
- Email login/setup preserves challenge hashes and uses email verification
  fields. Allowed Google/Apple proofs, cancellation, copied callback data and a
  finite challenge count have regressions and actual GramJS wire comparisons.
- One clock now schedules at most ten explicitly watched channels and common
  idle recovery. It allocates no timer per channel membership.
- Shared peer/contact/greeting/profile helpers and automatic message-origin file
  refresh are covered by regressions, including advertised-size truncation.
- Immutable formatted text supports runtime localized templates, UTF-16 offsets,
  bot text/captions and MTProto translation checked with the actual GramJS schema.
- HTTP requests validate deadlines before fetch, bound bodies, cancel body reads
  and release readers on success, overflow and cancellation.
- Shared bot sessions match actual grammY/Telegraf keys, initialization, deletion
  and failure-persistence policies; bounded LRU/TTL storage uses no key timers.
- Nested composers and Telegraf start/launch registration share bot dispatch.
  Telegraf username/context aliases remain distinct from grammY user aliases.
- Telegraf scene/wizard entry, persisted steps/state, expiry, reentry and leave
  match actual middleware; a finite per-update transition guard bounds loops.
- Native TCP implements four framing modes, bounded streams and send-only ACKs.
  Real local encrypted sockets, actual GramJS framing and a live anonymous
  production handshake verify the transport path.
- SOCKS5 CONNECT resolves domains at the proxy, supports IPv4/IPv6 and optional
  authentication, rejects downgrade/malformed replies and bounds negotiation.
- Direct obfuscation and MTProxy compare headers/stream bytes with actual GramJS;
  fragmented sockets verify signed test/media DC routing. A live anonymous
  obfuscated padded handshake succeeds. Fake TLS remains open.
- Native binary WebSocket validates upgrades, masking, continuation/control
  frames and TLS trust/hostnames, including SOCKS5 tunnels. An independent server
  and a live anonymous production key exchange verify interoperability.
- Disconnect awaits asynchronous cleanup on every DC, including after failures,
  and retains multiple failures without unhandled rejections.
- Shared receive buffers eliminate repeated whole-packet concatenation under
  fragmented TCP/WebSocket reads. Finite copy-budget regressions and storage
  reuse/immutability tests verify the change.
- In-process polling ownership and explicit membership subscriptions are tested.
- SOCKS4/4a CONNECT supports IPv4 and proxy DNS with bounded UTF-8 user IDs.
  Fragmented replies, rejection codes, deadlines and TLS WebSocket tunnels pass.
- The inherited duplication configuration scanned no files. A failing-before
  fixture now guards the detector, and shared helpers consolidate eleven actual
  clones. The repaired gate scans all 54 production JS/TS files with zero clones.
- The first repaired-gate CI run passed all runtime jobs but rejected a CLI flag
  accepted by a newer Deno-created local shim. The check now invokes locked
  jscpd 4.0.5 directly without that flag; its fixture and source scan pass locally.
- Thirteen failing-before update lifecycle regressions cover cancellation during
  initialization/scheduled recovery, draining accepted/reentrant handlers and
  saved cursors, independent failures and bounded notification/error retention.
- The channel scheduler uses the documented one-second fallback when a final
  difference omits its timeout; a failing-before fake-clock regression covers it.
- All 90 independently versioned secret-schema constructors round-trip. The
  codec retains historical IDs and flag-only fields missing from primary JSON;
  a handwritten wire vector and source-hash comparison verify serialization.
- Node/Bun/Deno each pass 254 tests; strict lint, format, the repaired duplication
  gate and declaration/example checks pass. Each later code change requires
  fresh checks. The package contains 59 permitted files.
- Refreshed issue/sub-issue and all three PR feedback streams are empty. Main is
  an ancestor of the branch. CI for 2598e6d passed all nine runtime/OS jobs and
  release gates in run 40791774228, including email authentication. Later heads
  require fresh CI evidence. The locked checker repair at e87752c passed all nine
  runtime/OS jobs and gates in run 40793885312.
- Research includes 32 complete discussions, 26 inspected images, nineteen pinned
  test-path inventories and all 333 Telegram-related meta-sovereign JS files.
- The npm dry run contains only source/package/README/LICENSE entries and
  excludes research, screenshots, experiments and optional client dependencies.

## Next steps

Current downstream work: preserve the verified connection and fixed-integer
compatibility checkpoints, then complete follow's wrapper/CLI migration. The unified scope now retains all
cleanup causes and the original work failure, including partial setup and
cancellation. Use the immutable follow source as the migration contract; write
reproducing tests before implementing missing behavior. Controlled-account
validation remains blocked without credentials; independent work continues.

The follow command/login checkpoint passes 480 tests on each runtime and strict checks,
with zero clones across 73 production sources and a 78-entry package dry run.
Pinned follow classes execute through the bridge, and a migrated command now
covers input/cache, login prompts, portable session persistence and option aliases.
Actual GramJS/teleproto construction/session exports and native TCP cover these
paths. Legacy standalone constructor/session compatibility and
controlled-account evidence remain open. Bridge head c55c44a passed all nine
runtime/OS jobs and applicable gates in run 40829426170.
CLI head d4b241c passed all nine runtime/OS jobs and applicable gates in run
40832057991, created 06:54:26Z and completed 06:56:31Z on 2026-10-29.
Eleven standalone connection regressions now pass, including actual-client and
native TCP checks. All 491 tests pass on each runtime, together with strict
checks and the zero-clone scan. Commit/push this checkpoint and verify fresh CI.
Connection head 16fc829 passed all nine runtime/OS jobs and applicable gates in
run 40833093614, created 07:04:30Z and completed 07:06:48Z on 2026-10-29.
Constructor/environment head 527b7cd and bounded storage head 2514dbc each passed
six Linux/macOS runtime jobs and static/release gates, but failed all three
Windows jobs on the same nonportable read-error fixture. The shared file store
correctly treats ENOENT as absent; Windows uses that code for a child of a regular
file. The repaired test reads an existing directory instead. The blocked write
and recovery assertions remain. [Native class evidence](api-classes.md) records
exact run IDs and failure log lines.

The native class checkpoint adds ten regressions and passes 524 tests on each
runtime, strict checks, exact declaration regeneration and compilation. The
clone scan covers 76 production sources with zero clones; 38 generated schema
declarations are excluded as data and compiled separately. The package contains
119 permitted entries. Head 6b3e3e0 passed all nine runtime/OS jobs and applicable
gates in run 40837895072 (07:49:20Z–07:51:59Z, 2026-10-29), verifying the
Windows fixture repair.

The request-bound checkpoint adds eight regressions and passes all 532 tests per
runtime plus strict checks. See [normalization evidence](request-limits.md).
Head d5f84c0 passed all nine runtime/OS jobs and applicable gates in run
40838745111 (07:57:15Z–08:01:17Z, 2026-10-29). Main remains an ancestor.

The [peer-resolution checkpoint](peer-resolution.md) adds seventeen regressions
for native API classes, nested requests, actual vendor argument bytes, selected
backend routing, cancellation and late-mutation depth bounds. All 549 tests pass
on each runtime, with strict checks and a zero-clone scan of 77 sources. The
package contains 120 permitted entries. Commit/push and verify fresh CI. Continue remaining
return/model and application contracts with failing-before tests.

The [facade-result checkpoint](gram-results.md) adds nine return-view regressions
and seven complete-value resource regressions. All 565 tests pass per runtime,
with strict checks, 77 scanned production sources and 120 package entries.
Commit/push and verify fresh CI. Next investigate nested bot update dispatch used
by terminal restart and execute the downstream command/lifecycle scenarios.

The [nested bot checkpoint](bot-reentrancy.md) adds fourteen regressions for
awaited child dispatch and borrowed session transactions. All 579 tests pass
per runtime, with strict checks, 78 scanned sources and 121 package entries.
Commit/push and verify CI. Execute the complete pinned terminal
sources next, correcting the application text-handler order and synthetic
command entities explicitly in the migration, then verify media/lifecycle flows.

The [Bot API edit/error checkpoint](bot-api-compatibility.md) adds nine
regressions after five initial tests and a direct-context test failed on incorrect grammY arguments/missing error data.
All 588 tests pass per runtime with strict checks, 78 scanned sources and
121 permitted package entries. Preserve the change and verify fresh CI. Continue the
complete pinned terminal source scenarios next; retain explicit migration
changes for application defects rather than claiming unchanged compatibility.

The [terminal source checkpoint](terminal-migration.md) reproduces and patches
nine application failures and six upload failures. Sixteen source scenarios
include the actual emulator, grammY comparisons and patch application; upload
preparation reuses shared traversal guards and adds finite byte/file limits.
The 610-test head 5a232706 passed all nine runtime/OS jobs and applicable gates
in run 40847213870, created 09:07:50Z and completed 09:10:19Z on 2026-10-29.
Three further failing-before regressions now verify polling drain, shared signal
shutdown and active-animation cancellation. Three isolated Node/Linux integrations
use real PTY children, actual canvas/GIF encoding and independent GIF decoding;
before/after PNGs and GIFs are preserved. Verify fresh matrix and native-job CI,
then continue keyboard/photo helpers and complete remaining lifecycle scenarios.
Rendering/shutdown head 2b8ef53f passed all nine runtime/OS jobs, native
integration and applicable gates in run 40848702436, created 09:19:14Z and
completed 09:22:16Z on 2026-10-29. Six native scenarios now execute complete
actual dotenv/pino startup and validate missing credentials, isolated paths and
successful file-log drain. One more failing-before regression verifies log
completion before successful exit. Head 9483b5c5 passed all nine runtime/OS jobs,
native integration and applicable gates in run 40849679128, created 09:26:44Z
and completed 09:29:06Z on 2026-10-29. Four additional real child-process
regressions now verify fatal startup logs before immediate exit. Verify fresh CI
after preserving the synchronous-destination change. Broader error recovery and
native runtime/OS coverage remain open alongside keyboard/photo/account evidence. Preserve all broader open
criteria and keep working independently of controlled-account credentials.

Keep protocol completion (secret chats/call media/transports), complete backend
return/event/style compatibility and actual downstream scenarios open in the
ledger. Continue with transport resource/cancellation gaps and the shared bot
session/scene and account scenario surfaces, each with a reproducing test.
Update PR #2 with current implementation and evidence; keep it draft until the
remaining requirements are genuinely implemented and verified.

## Current CI investigation

1. [x] List constructor/storage runs and verify head SHAs and timestamps.
2. [x] Preserve complete failed logs under ci-logs/ and read each platform failure.
3. [x] Identify the Windows ENOENT/ENOTDIR fixture assumption; retain actual store behavior.
4. [x] Use an existing-directory read failure and keep blocked write/recovery checks.
5. [x] Verify all nine OS/runtime jobs on head 6b3e3e0 in run 40837895072.
6. [x] Verify request-bound head d5f84c0 in run 40838745111.
7. [x] Verify peer-resolution head edb0ee7 in run 40841294344 (08:19:21Z–08:33:58Z).
8. [x] Verify facade-result head 937d596 in run 40842257601 (08:27:27Z–08:38:10Z).
9. [x] Verify nested bot head df05dff in run 40843982335 (08:41:38Z–08:44:06Z).

## Historical CI investigations

The layer-policy run 40801264105 passed eight runtime/OS jobs and all applicable
gates, but Node on macOS failed the existing TCP cancellation test. Preserved
logs show `TCP request timeout` at failed-job lines 1028–1045, originating in the
successful `send()` at test line 54. The test's 30 ms default unintentionally
bounded connection establishment as well as the intentionally idle read. Keep
the normal connection deadline and apply 30 ms only to that read. Verify the
focused TCP suite and fresh matrix CI; no production timeout is changed.

1. [x] List recent runs with timestamps and verify b11141b's SHA.
2. [x] Download run 40795826588 and all three failed Windows job logs.
3. [x] Identify the source-hash failure and reproduce the exact CRLF hash locally.
4. [x] Preserve archived bytes with Git attributes; add a checkout regression.
5. [x] Verify the repair in fresh CI, including all Windows runtime jobs.

The archive repair passes 196 local tests on each runtime and strict checks.

Archive repair head c996d26 passed all nine OS/runtime jobs and applicable gates
in run 40796417220. The sequence checkpoint adds nineteen regressions covering
role parity, ordered acknowledgements, duplicates, immediate resend processing,
bounded gaps/history, aborts, copied snapshots and restart recovery. Its 215
local tests and strict checks pass; fresh CI is required after committing it.

## Secret-chat implementation checklist

1. [x] Authenticate bounded MTProto 2.0 envelopes and retain historical TL IDs.
2. [x] Track ordered sequence/acknowledgement state and bounded resend caches.
3. [x] Export/validate copied snapshots and recover unsent frames/gap requests.
4. [x] Replace deleted unacknowledged frames with protocol deletion services.
5. [x] Prepare initial request/accept RPCs with recoverable DH/key state and binding checks.
6. [x] Integrate layer/cipher/sequence policy and the initial peer flow through native test peers.
7. [x] Implement compulsory PFS rotation and simultaneous key-exchange rules.
8. [x] Integrate encrypted RPC ordering, durable effects/cursors and file media.
9. [x] Implement read-triggered expiry and application history effects.
10. [ ] Verify interoperable flows with controlled Telegram accounts.

The subsequent TL ownership regression exposes Buffer.slice view aliasing.
Copied byte/fixed-integer fields pass all 216 tests on each runtime and strict
checks. Sequence head 236e916 passed all nine CI runtime/OS jobs in 40797579548.

Deleted unacknowledged messages now become self-deletion services with immutable
original headers and a second outgoing deletion. Five regressions cover both
roles, already-delivered and missing originals, restart state, resend content,
invalid targets and atomic capacity failures. All 221 tests pass on each runtime
with strict checks. TL byte-ownership head 07d27f9 passed CI run 40797847810.

Strict declaration/example checking is now an explicit `npm run typecheck` gate
in both `npm run check` and CI. The project includes every declaration and typed
example and keeps library checking enabled. The new gate passes locally.

The DH primitive now refreshes configuration before each initial exchange,
validates safe primes/generators/public values, mixes local entropy and consumes
private exponents on completion. Eight regressions cover bilateral and independent
platform DH, malformed inputs, fingerprints, restart snapshots, configuration
refresh/copying and cancellation. All 229 tests and strict checks pass on each
runtime. Deno's independent DH API restricts generators to 2/5, so the comparison
uses the valid RFC 3526 group with generator 2; Telegram's published generator-3
parameters remain covered by the bilateral tests. Request/accept RPC integration,
layer agreement and PFS remain open. Head 192d011 passed all nine runtime/OS jobs
and applicable gates in CI run 40798442235.

Outgoing layer upgrades now preserve exact old frames, including old-layer
deletions and JSON restoration. Three failing-before regressions pass with the
existing sequence/deletion tests. Layer notifications and cipher-version
negotiation remain the next integration steps.

The layer checkpoint passes all 232 tests on Node, Bun and Deno, strict lint,
format, duplication and full type checking. DH head 29f274e passed all nine
OS/runtime jobs and applicable gates in CI run 40799647031.

Explicit legacy envelope support now prepares initial layer negotiation while
keeping version 2 as the default and avoiding automatic format fallback. The
primary v1 specification is archived with a source hash. Sequence cutover and
downgrade policy remain integration work.

Legacy-envelope checks pass all 238 tests on each runtime, strict lint, format,
duplication and type checking. The package has 56 permitted entries. Layer
upgrade head 2d9b3d5 passed all nine runtime/OS jobs and gates in 40800006291.

Layer/version policy regressions cover notification races, sequence cutovers,
older gaps, queued downgrade violations, ordered service interpretation, local
upgrades and portable state. The policy is ready for integration with the
sequence/cipher primitives; initial request/accept RPCs, durable state/effects
and compulsory re-keying remain open.

The layer-policy checkpoint passes all 244 tests on Node, Bun and Deno, strict
lint, formatting, full declaration/example checks and the zero-clone scan of
52 production files. The package contains 57 permitted entries. Legacy envelope
head c465b65 passed all nine runtime/OS jobs and applicable gates in CI run 40800440156. Fresh CI is required for the policy commit.

Initial request/accept helpers now use mandatory persistence before RPCs and
before ready credentials, preserve deduplication IDs/exponents/keys through
restart, validate participant and final key bindings and discard invalid peers.
Ten focused tests include two native encrypted TCP clients and a real TL
encryption update. Full runtime and static checks are the next checkpoint.
TCP deadline repair f083ace passed all nine runtime/OS jobs and applicable gates
in CI run 40802116364; preserved logs identify the preceding macOS test failure.

The initial-handshake checkpoint passes all 254 tests on Node, Bun and Deno,
strict ESLint, Prettier, full declaration/example checks and the zero-clone scan
of 54 production files. The package dry run has 59 permitted entries. Main is
an ancestor, and refreshed issue/sub-issue and all three PR feedback streams
remain empty. Fresh CI is required after committing the handshake.

Handshake head 7134040 passed all nine runtime/OS jobs and applicable gates in
CI run 40802763164. Two new failing-before regressions isolate an incoming-layer
bug: outgoing layer 46 serialization stripped incoming layer-144 fields and
rejected large layer-143 document sizes. Separate receive serialization/decoding
now preserves exact queued frames through restart without upgrading outgoing
policy or relaxing outgoing-history validation. Focused sequence/layer tests
pass. All 256 tests pass on Node, Bun and Deno; strict lint, formatting, full
declaration/example checks and the zero-clone production scan also pass.

Incoming-layer head 33600f9 passed all nine runtime/OS jobs and applicable gates
in CI run 40803949654. The next checkpoint fixes generic-wrapper vector result
decoding and adds successful native RPC receipts with bounded, copied
`invokeAfterMsgs` dependencies. Five focused tests and a native encrypted TCP
integration test pass, including salt retries, migration/authorization handling,
failure preservation and finite invalid-input checks. All 262 tests pass on
Node, Bun and Deno. Strict lint, formatting, full declaration/example checks
and the zero-clone scan of 55 production files pass; the package dry run has
60 permitted entries. Durable session delivery remains the next open step.

RPC head 8b72c1b passed all nine runtime/OS jobs and applicable gates in
CI run 40804675053. The active session now combines the layer/cipher/sequence
policies, exact encrypted retransmission history, atomic message effects and
ordered native submission. Sixteen unit regressions cover retries, restart,
gaps, deletion, corruption, downgrade aborts, cancellation and owned snapshots.
A bilateral native encrypted TCP test verifies saving effects and sequence
state before the real update manager saves qts or acknowledges the queue.
Compulsory PFS, encrypted media and controlled live peers remain open; these
checks do not establish full secret-chat or ecosystem parity.

All 279 tests pass on Node, Bun and Deno. Strict ESLint, Prettier, complete
declaration/example checking and the zero-clone scan of 57 production files
pass. The package dry run has 62 permitted entries. Refreshed issue comments,
sub-issues and all three PR feedback streams remain empty. Fresh CI is required
after committing this checkpoint.

Durable session head 36f8f97 passed all nine runtime/OS jobs and applicable gates
in CI run 40806856623. PFS action handling now has eleven regressions covering
bilateral exchanges, signed collisions, lost commits, protected restart,
abort restrictions, cryptographic validation, key-use/age thresholds and the
old/new encryption boundary. A failing-before restore regression led to public
value validation for every active phase. Automatic session invocation, the key
ring, gap-aware erasure and visualization hashes remain the next PFS steps.

The PFS action checkpoint passes all 290 tests on Node, Bun and Deno and all
strict checks. The clone detector scans 58 production files with zero clones;
the package dry run has 63 permitted entries. Its typed draft-planning example
compiles. Fresh CI is required after committing the checkpoint.

Automatic PFS now passes twelve additional regressions, including interrupted
durable transitions, out-of-order candidate proof, simultaneous requests,
snapshot migration, bounded restored key observations, stable visualization,
corruption rejection and exact retransmission after key erasure. An older
single-key snapshot initially bypassed authentication for unknown fingerprints;
the failing test now requires authentication for that snapshot format.

A cross-rotation deletion test initially aborted with SECRET_CHAT_KEY_DOWNGRADE:
encrypting an old replacement under the current key moved the peer's switch
boundary before an old-key commit. Preparing the self-deletion ciphertext at
message creation preserves its original key without retaining that key after
erasure. The regression also restores JSON state before deletion and verifies
the exact prepared packet; corruption and combined byte limits have coverage.
The native encrypted TCP integration now completes a bilateral PFS exchange
through the actual update manager and preserves qts/effect ordering.

All 309 tests and strict checks pass locally on all three runtimes. The package
dry run contains 66 permitted entries. Fresh CI is required after this commit;
encrypted media and production-account interoperability remain open.

Key age now begins when the initial handshake derives the key, rather than
when the application eventually opens its active session. Two failing-before
assertions verify credential timestamps and compulsory rotation after delayed
session creation. Protected restart preserves that time; malformed timestamps
reject. All 310 tests pass on each runtime with strict checks. Integrated PFS
head e793a71 passed every gate and all nine runtime/OS jobs in run 40812109787,
created 2026-10-29T03:26:04Z and completed 2026-10-29T03:28:50Z. Fresh CI is
required for the age repair.

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
across 64 production sources; the npm dry run has 69 permitted entries. The typed
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
the package dry run has 70 permitted entries. The typed service example compiles.
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

The expiry head 19a4d57 passed all nine runtime/OS jobs and applicable gates in
run 40818522634, created 2026-10-29T04:34:36Z and completed
2026-10-29T04:47:33Z. Date head 6514127 passed all nine runtime/OS jobs and applicable gates in
run 40819580958, created 2026-10-29T04:46:07Z and completed
2026-10-29T04:50:58Z. Continue with
remaining native/downstream coverage and preserve the original scope; do not
mark the PR ready while any requirement remains unverified.

Downstream account workflow audit:

- Captured and read follow's complete Telegram library, follow/join CLIs,
  private-link/error/message/session experiments and license at immutable head.
- Added failing-before paged-dialog tests and an ownership regression, followed
  by the shared iterator, typed group index and actual backend/native matrix.
- Fixed the actual teleproto inherited-constructor-tag normalization failure
  exposed by that matrix. All 374 tests pass on Node/Bun/Deno; strict lint,
  formatting, types, the zero-clone scan of 69 sources and the 74-entry package
  dry run pass. Preserve the checkpoint and await its new CI run.
- Reproduced and fixed legacy invite links, host anchoring, layer-232 nested
  join caching and cancellation across lookup/join. All 388 tests pass on
  Node/Bun/Deno with strict lint, formatting, types, zero clones across 70
  sources and a 75-entry package dry run. Actual clients and native TCP cover
  private import followed by settings; approval/verification outcomes stay explicit.
- Added shared invite/notification inspection and the bounded follow workflow,
  including exact private membership confirmation, existing groups, aliases,
  approval/verification, settings, history, leave and rate-limit outcomes.
  Nineteen regressions include batch/settings ownership failures, actual clients
  and encrypted TCP; all 407 tests and strict checks pass on each runtime.
- Added an owned connection scope with bounded disconnect/destroy retries,
  original-error preservation, cancellation and shared backend ownership.
  Eighteen regressions include actual GramJS/teleproto destruction and native
  TCP closure. All 425 tests and strict checks pass on each runtime.
- Next: downstream wrapper/CLI migration and controlled-account evidence.
- Terminal fatal-exit audit: four real child-process probes reproduced a missing
  file after immediate exit with either required credential missing. The explicit
  migration uses a synchronous pino destination and awaits its finish event on
  successful shutdown. Thirteen isolated native cases pass locally. Preserve
  this atomic change after full checks, then continue downstream/media/runtime
  implementation; this does not satisfy the broader terminal requirement.
- Continue all other unmet protocol/runtime/compatibility/downstream criteria.
  Controlled accounts and official-app-only passkeys remain externally blocked;
  independent implementation work remains available. Keep PR #2 draft/unmerged.

Bot file inputs: ten initial failures reproduce missing path/stream/supplier
handling; two further failures reproduce empty-chunk bookkeeping and late-source
leaks. Nineteen cases cover the native transport through shared readers and
cancellation. Verify all runtimes and static gates, commit this atomic change,
then implement optional vendor-backend/account-media conversion and continue the
remaining downstream scenarios. Keep all unverified criteria open.

Late file-source cleanup: a real bounded Linux FIFO probe failed because a
10 ms request deadline awaited a blocked open until its delayed writer arrived.
The request now rejects before that release and closes the eventual handle. A
further failing-before portable test covers cancellation of a URL body returned
after cancellation. Verify 634 portable cases, thirteen native integrations and
the separate FIFO probe, then preserve the atomic fix and continue optional
vendor/account InputFile integration. Every broader unmet criterion remains open.

Optional vendor uploads: seventeen portable cases now exercise owned file
conversion, actual grammY/node-telegram-bot-api multipart, existing vendor inputs,
aggregate/structural guards, late cleanup, automatic construction, legacy formData
and deadlines through dispatch. Actual Telegraf wire tests pass on Node 20.18.3;
two newer-runtime attempts reproduce its original encoder stall independently of
owned files. Preserve the finite standalone reproducer and leave that criterion
open. Verify 651 core cases on all runtimes, strict gates, the two wire cases,
thirteen native terminal cases and the separate FIFO probe, commit/push, inspect
fresh CI, then continue account-media InputFile support and broader requirements.
The preceding cleanup head c2fc60bf passed all CI jobs in run 40854061428
(created 2026-10-29T10:00:21Z; completed 2026-10-29T10:03:02Z).

Account InputFile work plan:

- [x] Refresh the complete issue and all three PR feedback streams; no new comments.
- [x] Reproduce ten failures before implementation, including secret-file native TCP.
- [x] Share bounded readers with cloud and encrypted uploads without a module cycle.
- [x] Route owned GramJS/teleproto files through the shared upload implementation.
- [x] Verify actual serializer bytes, mtcute writer, albums, source forms and cleanup.
- [x] Run all 670 tests on Node, Bun and Deno; strict checks and package audit.
- [x] Run isolated native terminal, Telegraf Node 20 wire and FIFO probes.
- [x] Review the complete atomic diff, merge fresh main if needed, commit and push.
      Account checkpoint: 79d5645916e55d802b289e9a1601ca015e672893.
- [x] Verify fresh CI by timestamp and SHA; preserve/analyze any failing logs.
      All jobs passed in run 40858010735, completed 2026-10-29T10:37:46Z.
- [ ] Continue all remaining criteria, including the newer-runtime vendor encoder
      and complete downstream migrations. Keep PR #2 draft and unmerged.

Account checkpoint validation: all 670 tests pass on Node, Bun and Deno; the
nineteen new account cases also pass on Node 20.18.3. Strict lint, formatting,
complete types and schema regeneration pass, with zero clones across 83 sources.
The npm dry run has 126 permitted entries. Thirteen isolated native terminal
cases, two actual Telegraf Node 20 wire cases and the separate bounded FIFO
probe pass. Fresh main is an ancestor. Fresh CI is still required for this head;
the preceding vendor head 0be0437 passed all gates in run 40856101337,
created 2026-10-29T10:15:22Z. The account head passed every job in run
40858010735, created 2026-10-29T10:29:50Z and completed 2026-10-29T10:37:46Z.

Shared high-level bot operation work plan:

- [x] Refresh the complete issue and all three feedback streams; no comments.
- [x] Reproduce fourteen failures before implementation, plus grammY raw signatures.
- [x] Share six canonical translations across all four selected bot transports.
- [x] Verify actual automatic SDK construction and finite local HTTP requests.
- [x] Separate request controls and preserve explicit object-message options.
- [x] Run 685 tests on all runtimes, Node 20 focused tests and strict gates.
- [x] Review the atomic diff, audit the package, commit/push and inspect fresh CI.
      Bot checkpoint c3832f3 passed every job in run 40859500804.
- [ ] Continue full backend/framework/downstream criteria; keep PR draft/unmerged.

See [bot operation evidence](bot-operations.md). Node, Bun and Deno pass all 685
cases; the focused fifteen cases also pass Node 20.18.3. Strict gates pass with
zero clones across 84 production sources. The full Bun rerun passes after
correcting declared gzip decoding in the independent oracle. This checkpoint
does not close any broader open criterion.

Thirteen native terminal integrations, two actual Telegraf Node 20 multipart
cases and the bounded Linux FIFO probe pass. The package audit has 127 permitted
entries. Fresh main is an ancestor; every atomic production change was reviewed.

Community posting work plan:

- [x] Verify the complete pinned source and package against current upstream.
- [x] Execute the original to reproduce cross-user capture, reset limits,
      missing callback acknowledgements and deletion before replacement.
- [x] Share bot/account transports in a complete posting/lifting example.
- [x] Persist bounded per-user limits, prompts and delivery/cleanup state before
      side effects; retain ambiguous deliveries without automatic replay.
- [x] Use bounded account search, preserve originals on failed replacement and
      verify restart, concurrency, errors, cancellation and listener cleanup.
- [x] Run focused actual-backend/native transport cases and all runtime suites:
      724 cases per runtime, plus 39 community cases on Node 20.18.3.
- [x] Run strict static/package gates, 13 native terminal integrations, two
      actual Telegraf Node 20 wire cases and the bounded FIFO probe.
- [x] Commit the reviewed atomic work, push and inspect fresh CI by SHA/time:
      community head 1c16f5c passed all runtime/OS jobs and applicable gates in
      run 40862796563, created 2026-10-29T11:06:27Z, completed 11:19:15Z.
- [ ] Continue every other open requirement; retain draft/unmerged status.

Bot context cancellation work plan:

- [x] Compare actual grammY positional/context signals and Telegraf signatures.
- [x] Reproduce lost signals and controls leaking into positional payloads.
- [x] Share request-control separation with canonical bot operations and retain
      raw Telegram parameters such as getUpdates.timeout.
- [x] Verify context/event aliases, owned-source deadlines and selected backends.
- [x] Update checked declarations/examples and pass all 747 tests per runtime,
      23 Node 20 cases, strict gates, native terminal/wire cases and package audit.
- [x] Commit the reviewed bot context-control change, push and inspect fresh CI.
      Head f3c544e passed every applicable job in run 40864702944, created
      2026-10-29T11:21:04Z and completed 11:29:36Z.
- [ ] Continue the complete feature union and all other open requirements.

Bot handler recovery work plan:

- [x] Compare actual Telegraf error/callback context identity and return behavior.
- [x] Reproduce event listener failures bypassing registered catchers.
- [x] Cover async catchers, nested updates, retryable failures and queue release.
- [x] Keep shared wrapped errors and add Telegraf's two-argument contract.
- [x] Share catch boundaries across event and middleware dispatch without replay.
- [x] Check declarations, all 757 cases on each runtime, strict static gates,
      25 focused Node 20 cases, 13 native terminal cases and package contents.
- [x] Commit the reviewed recovery change, push and verify fresh CI by SHA/time.
      Head 2c96128 passed every applicable job in run 40866197953, created
      2026-10-29T11:32:41Z and completed 11:35:28Z.
- [ ] Continue every other open acceptance criterion in this single draft PR.

Original terminal suite execution work plan:

- [x] Read all eight original test files and five debug scripts against the
      pinned manifest; identify assertions, diagnostics and broken debug imports.
- [x] Execute complete verified bodies in separate bounded child processes and
      preserve their output; reproduce any real emulator or application failures.
- [x] Bridge the demonstrated debug import error explicitly while keeping
      archived sources immutable. All original assertions pass without emulator
      changes; distinguish seven diagnostics from six assertion-driven suites.
- [x] Pass strict static gates, all 26 native checks and thirteen Node 20 scripts.
- [x] Verify strict gates and native integration, commit and inspect fresh CI.
      Head 6f69ce3 passed every applicable job in run 40866789779, created
      2026-10-29T11:37:15Z and completed 11:40:16Z.
- [ ] Continue keyboard/photo, platform/runtime and controlled Telegram criteria.

Complete pinned grammY positional API work plan:

- [x] Inventory every public positional signature and method/field mapping from
      the actual pinned SDK; preserve metadata facts without copying SDK code.
- [x] Compare every supported mapping against actual public SDK calls and first
      reproduce positional fallthrough failures, including inline/alias methods.
- [x] Route descriptors through shared request control and backend operations,
      retaining raw object access, method aliases and conditional rich messages.
- [x] Compile checked declarations/examples and verify each selected backend,
      cancellation, upload controls, runtime suites and strict/package gates.
- [ ] Review the atomic diff, commit/push, verify fresh CI and continue all other
      open requirements without presenting this comparison set as full parity.

Bot query registration work plan:

- [x] Compare all six pinned grammY query registration shortcuts, trigger arrays,
      exact string/RegExp matches and returned scoped composers before fixing.
- [x] Share asynchronous filtering and query registration across bots/composers,
      preserve existing action behavior and expose missing context aliases.
- [x] Verify actual selected-backend HTTP callback acknowledgement/edit requests,
      predicate failures, declaration examples and immutable update fields.
- [x] Pass all 989 core tests per runtime, fifteen focused Node 20 cases,
      strict static gates, 26 native checks, vendor wire/FIFO and package audit.
- [ ] Pass focused/full runtime suites, strict static/package and integration
      gates; review the diff, commit/push and inspect fresh CI by SHA/time.
- [ ] Continue all remaining issue criteria in this draft, unmerged PR.
