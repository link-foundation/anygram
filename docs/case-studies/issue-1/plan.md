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
  clones. The repaired gate scans all 52 production JS/TS files with zero clones.
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
- Node/Bun/Deno each pass 244 tests; strict lint, format, the repaired duplication
  gate and declaration/example checks pass. Each later code change requires
  fresh checks. The package contains 57 permitted files.
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

Keep protocol completion (secret chats/call media/transports), complete backend
return/event/style compatibility and actual downstream scenarios open in the
ledger. Continue with transport resource/cancellation gaps and the shared bot
session/scene and account scenario surfaces, each with a reproducing test.
Update PR #2 with current implementation and evidence; keep it draft until the
remaining requirements are genuinely implemented and verified.

## Current CI investigation

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
5. [ ] Negotiate/accept DH keys, agree layers and support initial peer exchange.
6. [ ] Implement compulsory PFS rotation and simultaneous key-exchange rules.
7. [ ] Integrate encrypted RPC ordering, durable effects/cursors and file media.
8. [ ] Verify interoperable flows with controlled Telegram accounts.

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
