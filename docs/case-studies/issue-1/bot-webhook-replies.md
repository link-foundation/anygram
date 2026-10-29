# Webhook response ownership

This advances R01/R05/R08/R13/R16/R17/R19 in
[PR #2](https://github.com/link-foundation/anygram/pull/2).
The preceding runner discarded `handleUpdate`'s response argument. A handler
always issued a separate HTTP request, even when the application selected a
webhook reply. The first 13 actual-SDK comparisons reproduce 12 failures.

Each dispatched update now receives scoped APIs sharing one response claim.
grammY-style replies require `client.canUseWebhookReply(method)` to return true;
the default remains disabled. Telegraf-style replies inherit the global
`telegram.webhookReply` setting and permit its five documented methods:
`answerCallbackQuery`, `answerInlineQuery`, `deleteMessage`, `leaveChat` and
`sendChatAction`. Context changes to this flag remain local to the update.
Global APIs continue to use the selected transport.

The first eligible JSON operation claims the response before awaiting its
sender. Concurrent calls cannot claim it twice. Nested updates have independent
claims. Uploads retain ordinary HTTP dispatch and do not consume a JSON reply.
A failed sender consumes its claim and propagates the error without replaying
the operation. Fast replies resolve to `true`, and disregard a request abort
signal, matching the actual SDK behavior. Request signals still govern fallback
HTTP calls. Applications must await their handler work.

An owned safety extension retires unused claims after dispatch; a retained
context subsequently uses its transport. Node responses are ended even when no
operation qualifies or a duplicate update is ignored. Cleanup releases update
processing ownership even if ending the response throws. The existing Fetch
callback returns the serialized JSON operation when a handler selects one.

```sh
node --experimental-loader ./experiments/webhook-before-loader.mjs --test \
  tests/bot-webhook-replies.test.js tests/bot-webhook-ownership.test.js \
  tests/bot-webhook-http.test.js
node --test tests/bot-webhook-replies.test.js \
  tests/bot-webhook-ownership.test.js tests/bot-webhook-http.test.js
```

The immutable loader freezes `src/bot.js` at preceding head
`d4c76ce80b21943390dd4f762f247e0301194069`, retaining the exact final tests and
actual grammY 1.46.0 / Telegraf 4.16.3 SDKs. It reproduces 27 failures out of
31 cases; the current implementation passes all 31. Sixteen comparisons run
both actual SDKs against independent bounded HTTP fixtures. Eight additional
cases verify fallback through actual selected native, grammY, Telegraf and
node-telegram-bot-api clients. Three incoming HTTP cases use real Node responses;
the remaining cases cover retired/error scopes and the Fetch response.

Checked portable examples compile against both the owned declarations and
actual SDKs. A separate fixture verifies that the structural response contract
accepts current Node `ServerResponse` types without introducing Node ambient
types into the public package. The subsequent
[framework adapter work](bot-webhook-frameworks.md) covers all named grammY
entries. Complete server lifecycle APIs, controlled Telegram delivery and every
wider unfinished issue criterion remain open; these response tests do not
establish full SDK parity.

`node experiments/composer-fluency-check.mjs --webhooks --before` preserves the
declaration reproduction; the preceding types produce five diagnostics. Run the
same command without `--before` and the SDK compatibility compiler to verify the
owned and actual SDK fixtures respectively.

Local validation passes all 2,053 core tests on each of Node, Bun and Deno,
27 isolated native terminal checks and six Node 20 wire cases. Strict static
checks scan 156 production sources with zero clones; packaging permits 199
entries. Main remains an ancestor and all four issue/PR feedback streams are
empty at this checkpoint.
