# Nested bot updates and session ownership

The terminal application's restart handler awaits `bot.handleUpdate` from inside
another handler. The shared bot runner previously queued that child behind its
parent, which awaited the child forever. Eight failing-before tests with finite
one-second deadlines are retained in `ci-logs/bot-reentrancy-before.log`.

The runner now uses an active asynchronous task context. Awaited child updates
execute inside their owner; unrelated updates retain the existing queue. Active
ancestor IDs are deduplicated, nested depth is limited to 64, errors retain their
child context and failed handlers release the queue. Contexts expire when their
task settles, so delayed descendants return to the external queue. This uses
the built-in AsyncLocalStorage on the supported Node/Bun/Deno runtimes; browser
runtime support remains a separate unfinished criterion.

Session middleware borrows an active same-key transaction instead of waiting on
its own key lock. Nested contexts share the session property, including whole
value replacement and deletion. A different key has its own transaction; a later
same-key descendant can still borrow an active ancestor. The outer owner writes
once. grammY-style success-only persistence and Telegraf-style finally persistence
remain intact, as do unrelated per-key serialization and pending limits.

Fourteen regressions cover these paths, bounded duplicate/depth probes and stale
asynchronous contexts. `experiments/bot-session-nesting.mjs` records traces from
the actual installed grammY/Telegraf middleware and both shared styles. In this
specific nested scenario, grammY reads twice and overwrites the child's replaced
value with the outer value. Telegraf shares the replacement but writes twice.
The shared styles preserve the replacement and write once. This is a deliberate
ownership guarantee, rather than a claim of identical behavior for this upstream
data-loss case.

`experiments/collect-terminal-source.mjs` captures 20 complete primary-source
files at `7f3aeee50965160b31dca62b6e5b4e4a7af99bea`, including both bots, the
terminal emulator, tests and license. The manifest records exact byte counts,
Git blob IDs, SHA-256 hashes and immutable URLs. The earlier individual `terminal-text-bot.js` snapshot is also complete at
20584 bytes; an initial tool display stopped at 20000 bytes. Byte verification
avoids treating that display truncation as an incomplete archive. Subsequent
migration work uses the complete source tree.

The source also registers the general text handler before stop/restart/help and
constructs its synthetic restart message without a bot_command entity. Those
application-level routing defects require explicit migration handling. The
shared dispatch fix alone does not establish full terminal-bot compatibility,
rendering/media support, production integration or complete framework parity.
All remain open in the requirement ledger. All 579 tests pass on Node, Bun and
Deno. Strict lint, formatting, full declaration/example checks and the zero-clone
scan of 78 production sources pass; the package dry run has 121 permitted entries.
Fresh matrix CI is required for this checkpoint.

Head df05dff passed all nine runtime/OS jobs and applicable gates in
[run 40843982335](https://github.com/link-foundation/anygram/actions/runs/40843982335),
created 2026-10-29T08:41:38Z and completed 2026-10-29T08:44:06Z.
