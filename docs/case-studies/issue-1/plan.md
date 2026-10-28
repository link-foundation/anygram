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
- In-process polling ownership and explicit membership subscriptions are tested.
- After SOCKS5 regressions, Node/Bun/Deno each pass 137 tests; lint, format, duplication and
  four declaration entry points pass. Each later code change requires fresh checks.
- Refreshed issue/sub-issue and all three PR feedback streams are empty. Main is
  an ancestor of the branch. CI for f4c6de9 passed all nine runtime/OS jobs and
  release gates in run 40785578378, including native TCP. Later heads
  require fresh CI evidence.
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
