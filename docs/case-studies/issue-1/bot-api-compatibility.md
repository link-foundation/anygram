# Terminal edit signatures and Bot API failure data

The complete pinned terminal sources call
`ctx.api.editMessageText(chatId, messageId, text, options)`. The shared API
previously interpreted the third argument as Telegraf's inline message ID and
the fourth as text. It sent an object as `text`, lost the parse mode and could
not forward grammY's fifth cancellation argument. Its dynamic fallback also
sent `editMessageTextInline` as a nonexistent Bot API method.

`bot.api` now has grammY's chat and inline text-edit signatures; `bot.telegram`
has Telegraf's chat/inline signature. Both use the same formatted-text conversion
and selected transport. Context edits construct the shared raw request directly,
so chat and inline callbacks do not depend on either positional signature.
The corresponding context property receives the same Telegraf view as the bot.
The public declarations and `examples/typed-bot-api.ts` check these signatures.

The terminal source inspects `error.error_code` when an edit fails, ignoring
unchanged content and sending a new message for other 400 errors. The native
transport previously exposed only `code`, so that recovery branch never ran.
Native Bot API errors now retain `ok`, `error_code`, `description`, `parameters`,
`response` and the method name alongside the existing common error fields.
The response description is token-redacted before any alias is constructed.
Actual grammY and Telegraf errors normalize through the same error factory,
preserving their original cause and copying response parameters. No send is
retried automatically. This provides shared failure data; it does not claim
vendor error-class identity, full request payload capture or complete framework
compatibility.

Nine regressions compare installed grammY/Telegraf request payloads, signal
identity, both context styles, chat/inline callbacks, structured edit failures,
actual vendor errors and token redaction. Five fail before implementation in
`ci-logs/bot-api-compatibility-before.log`; the other three preserve previously
working Telegraf and context behavior. The focused suite passes afterward.
A separate failing-before regression preserves the Telegraf view for direct
Context construction. All 588 tests pass on Node, Bun and Deno. Strict lint, formatting, full
declaration/example checks and a zero-clone scan of 78 production sources pass;
the package dry run has 121 permitted entries. Fresh matrix CI is required.

This advances R01/R13/R19. Full terminal source execution, command-order and
synthetic-entity migration, animation uploads and lifecycle evidence remain open,
alongside every other unverified requirement in the acceptance ledger.

Head b5ab988 passed all nine runtime/OS jobs and applicable gates in
[run 40845289559](https://github.com/link-foundation/anygram/actions/runs/40845289559),
created 2026-10-29T08:52:24Z and completed 2026-10-29T08:55:12Z.
The following [terminal checkpoint](terminal-migration.md) adds bounded execution
of both pinned application handler sets; its open criteria remain explicit.
