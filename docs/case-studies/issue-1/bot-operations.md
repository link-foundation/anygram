# Shared high-level bot operations

Issue #1 requires the same unified operations through the selected backend.
Before this checkpoint, `createClient({ token, native: false, libraries:
['grammy'] }).getMe()` rejected as unsupported. The actual vendor stores its API
on `bot.api`; Telegraf uses `bot.telegram`, and the current node-telegram-bot-api
also uses `bot.api`. Direct client method lookup missed these boundaries.

Native helpers spread `signal` and `timeout` into Bot API payloads while omitting
the request options argument. Cancellation and per-call deadlines were ignored.
Object-form `Anygram.sendMessage` also discarded its explicit third argument.
The initial fourteen tests all failed before implementation. A subsequent actual
grammY wire test exposed its raw zero-payload signature: `raw.getMe(signal)`
already binds the empty payload. Passing `({}, signal)` supplied the wrong
signal. Its additional reproducing test failed before the boundary correction.

## Implementation and reproduction

`BotOperations` translates six canonical operations once: identity, text send,
text edit, batch delete, batch forward and document send. The native transport
inherits these helpers; every bot adapter constructs the same operation view
over its selected raw requester. SDK serialization, middleware transformers and
transport ownership remain with that SDK. Existing extended methods remain
accessible through `backend()`.

Request controls are separated before text/caption formatting and dispatch. The
owned upload deadline therefore starts before preparing a blocked supplier.
Object message aliases are removed from payload options; explicit options merge
after embedded options. `getMe` and batch deletion declarations now accept
request controls, with a compiling example in `examples/typed-bot-uploads.ts`.

Run `node --test tests/bot-operations.test.js` to reproduce and verify:

- Automatic construction of each actual pinned backend, followed by all six
  operations against a finite local HTTP server. The oracle checks exact method
  names, large IDs, forwarded IDs, formatted entities and absence of controls.
- Pre-cancellation of all six operations, with no HTTP request, on every backend.
- A per-call deadline while a reusable owned source supplier remains blocked,
  bounded by an independent finite watchdog and eventual supplier release.
- Direct native helper cancellation and explicit object-message option merging.
- All eight pinned grammY zero-payload raw signatures, with actual HTTP calls.

The oracle independently decodes JSON and URL-encoded requests; Bun's Telegraf
request uses declared gzip encoding, decoded with a 64 KiB output limit. Its
initial full Bun run found this fixture gap. Correcting the oracle preserves
the vendor bytes and verifies the same decoded Telegram parameters. Every
fixture limits request size/count, socket time and request time.

## Scope

This checkpoint covers the six listed canonical methods and actual SDK wire
boundaries. The wider account operation union, framework/plugin semantics and
controlled Telegram application scenarios remain open. Telegraf's separately
documented multipart encoder stall on newer runtimes also remains open; these
JSON and URL-encoded comparisons do not establish multipart compatibility.

All 685 core cases pass on Node, Bun and Deno; the fifteen focused cases also
pass Node 20.18.3. Strict lint, formatting, complete type/example checks and exact
schema regeneration pass, with zero clones across 84 production sources. The
package audit contains 127 permitted entries. Thirteen isolated native terminal
cases, two Telegraf Node 20 multipart cases and the bounded FIFO probe pass.
