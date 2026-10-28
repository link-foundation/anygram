# Issue #1 execution plan

Objective: implement and verify every issue requirement in PR #2, including the
widest requested protocol, compatibility, and downstream-project scope. Keep
unverified criteria open; passing CI alone does not establish protocol parity.

1. [x] Read the entire issue, issue comments, sub-issue inventory, and all three
       PR feedback streams. There are currently no comments or sub-issues.
2. [x] Inspect the template, release pipeline, tests, and repository guidance.
3. [ ] Archive primary-source research on JavaScript and other-language clients,
       top competitor issues, command-stream, and all five downstream projects.
4. [ ] Inventory every requirement and map implementation and verification.
5. [ ] Write failing, minimal tests for unified routing, backend selection,
       compatibility styles, native operation, and error handling.
6. [ ] Implement the shared operation pipeline and optional adapters without
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
12. [ ] Commit useful atomic changes on issue-1-1052f45c2e5e after checks pass.
13. [ ] Fetch/merge main, review the complete PR diff and preserve all features.
14. [ ] Push only the prepared branch; replace PR #2 title/body and retain Fixes #1.
15. [ ] Check recent CI timestamps/SHAs; download and read every failed run log,
        fix root causes, and verify all checks on the latest commit.
16. [ ] Verify requirement evidence, clean git status, and mark PR #2 ready only
        when all requested work is implemented and verified. Keep the PR unmerged.

Experiments belong in experiments/; reusable application scenarios belong in
examples/. No live credentials or sessions may be included in research data.
