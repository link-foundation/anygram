# Bot context cancellation and deadlines

The shared canonical bot methods accepted request controls, but the positional
views used by middleware applications had their own payload construction.
Supported grammY sends, deletion, callback answers and context replies dropped
their final signal. Embedded `signal` and `timeout` options became Telegram
payload fields. In particular, a context document reply could wait indefinitely
for a blocked file supplier despite its explicit request deadline. Zero-payload
helpers also treated grammY's only signal argument as a payload.

The initial twenty-case regression run passed one case and failed nineteen.
The failing-before log is preserved locally at
`ci-logs/context-controls-before.log`. Four independently bounded blocked-source
cases reproduced the deadline failure on automatically constructed native,
grammY, Telegraf and node-telegram-bot-api backends. Each source is released in
cleanup, even when the independent watchdog detects the original failure.

## Shared translation

Canonical methods, supported positional helpers, context edits and event aliases
now use the same operation translator. It extracts request signals and deadlines
before formatting the remaining Telegram fields, without mutating caller options.
An explicit final signal takes precedence over an embedded signal. Media helpers
forward that signal before source preparation, through the selected backend.

Raw calls preserve their payload. Telegram's `getUpdates.timeout` is a long-poll
duration in seconds, distinct from a request deadline in milliseconds. Raw calls
accept a signal as their last argument; the eight pinned grammY zero-payload raw
methods accept their signal as their only argument. A shared method inventory
keeps this boundary consistent with the actual selected grammY backend.

Context deletion accepts both grammY's current-message signal and Telegraf's
explicit numeric message ID. Explicit-ID deletion can also take request controls.
Telegraf's separate positional text-edit signature remains intact. Checked type
declarations include the supported media helpers and context signatures, with
compiling usage in `examples/typed-bot-uploads.ts`.

## Verification

Run `node --test tests/bot-context-controls.test.js`. All 23 cases pass, covering:

- Actual pinned grammY positional and context methods, comparing payloads and
  signal identity at its public transformer boundary.
- Actual pinned Telegraf positional and context payloads, including its edit
  argument order and explicit-ID deletion.
- Every supported send/media/edit helper, eight zero-payload methods on both
  positional and raw views, and pre-cancellation with zero native dispatches.
- Embedded request controls on both positional views, both context constructors
  and node-style event aliases; immutable options and signal precedence.
- Raw Telegram timeout preservation and all four selected-backend blocked-source
  deadlines, bounded by a separate watchdog.

The Telegraf context oracle uses its `answerCbQuery` name; the shared context
currently exposes `answerCallbackQuery`. This comparison checks equivalent
payloads and does not claim complete alias compatibility. Broader context fields,
framework/plugin semantics, newer-runtime Telegraf multipart behavior and the
other open issue requirements remain unfinished.

All 747 core cases pass on Node, Bun and Deno. The 23 focused cases also pass
Node 20.18.3. The full runtime suites retain the earlier canonical-operation,
upload, reentrancy, session, scene and downstream regressions.

Strict lint, formatting, complete declaration/example compilation and exact schema
regeneration pass. The duplication gate scans all 84 production sources with
zero clones, including shared method types for event aliases. The package dry
run retains 127 permitted entries. Thirteen isolated native terminal cases, two
actual Telegraf multipart cases on Node 20 and the bounded Linux FIFO probe pass.
Fresh CI is required for this change. The preceding community head 1c16f5c
passed all nine OS/runtime jobs, native integration and applicable gates in
[run 40862796563](https://github.com/link-foundation/anygram/actions/runs/40862796563),
created 2026-10-29T11:06:27Z and completed 2026-10-29T11:19:15Z.
