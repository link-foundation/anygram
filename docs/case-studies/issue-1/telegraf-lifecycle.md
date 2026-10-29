# Telegraf callback, context and server lifecycle

This advances R01/R05/R08/R13/R16/R17/R19 in
[PR #2](https://github.com/link-foundation/anygram/pull/2). The preceding runner
only provided `launch` as an alias for owned polling. It lacked the pinned
Telegraf 4.16.3 callback, registration, server and context-construction APIs.

`bot.webhookCallback(path, { secretToken })` now accepts preparsed objects,
JSON strings, Buffers and raw Node request streams. It checks method, exact
path and secret before body consumption or initialization. Rejected requests
invoke the supplied `next`, or close with 403. Malformed JSON closes with 415.
The custom `webhookFilter` receives the SDK's bound path/secret object.
`createWebhook` registers the normalized HTTPS URL and returns the callback;
its default path and `secretPathComponent` match the SDK's token/runtime hash.
The bot-level `webhookReply` alias controls scoped Telegram reply policy.

```js
const bot = new Telegraf(token, { handlerTimeout: 1500 });
await bot.launch({
  dropPendingUpdates: true,
  allowedUpdates: ['message'],
  webhook: {
    domain: 'example.org',
    path: '/updates',
    host: '127.0.0.1',
    port: 8443,
    secretToken: secret,
  },
});
// Stop the owned listener when the application shuts down.
bot.stop('shutdown');
```

Launch supports HTTP, supplied Node TLS options, the legacy `hookPath`, fallback
request listeners, IP/max-connection/certificate registration fields and a
launch callback. It waits for binding before registering, propagates bind/TLS
failures and rolls back a listener after failed registration. Stop cancels
pending startup and closes the listener; concurrent launches reject. Polling
normalizes `dropPendingUpdates`/`allowedUpdates`, removes a prior Telegram
webhook and retains owned finite polling controls. The existing
`launch({ maxPolls: 0 })` extension performs no polling or webhook deletion.
Owned stop remains idempotent; the SDK throws before startup. Framework callback
creation prevents polling conflicts while preserving `/start` registration.

Direct Telegraf updates initialize bot information once across concurrent calls.
Failed owned initialization can retry. `contextType` receives the SDK's three
constructor arguments, including the scoped Telegram API; `bot.context` overlays
application fields. Handler deadlines reach the configured error/context handler
with the SDK's timeout name/message and close the response. Existing queue,
duplicate-update, nested-dispatch and selected-backend behavior is retained.

Owned callbacks also accept `maxBytes` (default 1 MiB) and
`timeoutMilliseconds` (default 90 seconds). The read deadline includes body
collection and initialization. Oversized input closes with 413; expiry releases
owned stream listeners and prevents dispatch after late initialization. Handler
timeout is configured separately by `handlerTimeout` (default 90 seconds).
Arbitrary application promises cannot be forcibly cancelled. Raw request headers
also have the Node server's 60-second deadline and requests its 90-second bound.

```sh
node --loader ./experiments/telegraf-lifecycle-before-loader.mjs --test \
  tests/telegraf-webhook.test.js tests/telegraf-construction.test.js \
  tests/telegraf-server.test.js tests/telegraf-webhook-bounds.test.js
node --test tests/telegraf-webhook.test.js tests/telegraf-construction.test.js \
  tests/telegraf-server.test.js tests/telegraf-webhook-bounds.test.js
node experiments/composer-fluency-check.mjs --telegraf-lifecycle --before
node experiments/composer-fluency-check.mjs --telegraf-lifecycle
```

The immutable runner is frozen at
`197d5a1baedf3f10c24e6005a08fad79518e68ee`. It reproduces 54 failures among
55 final cases; the stopped-initialization guard already passed. Initial suites
independently reproduced all 27 callback/registration failures, four context
failures and 12 server failures before their implementations. The SDK observation
script records accepted body forms and reply policy. Real bounded HTTP and TLS
requests compare SDK and owned registration, reply, forbidden, fallback and
malformed behavior. Failure/retry/cancellation cases verify listener cleanup.
Checked portable examples compare actual SDK declarations; preceding public
declarations reproduce 18 diagnostics. Real Node request/response/listener types
also compile without adding Node ambient dependencies to the public declarations.

All 2,198 core tests pass on Node, Bun and Deno, alongside 27 isolated native
checks, six Node 20 wire comparisons and sixteen parser-fact checks. Strict
ESLint, formatting, declaration/example and exact-regeneration gates pass. The
duplication scan covers 165 production files with zero clones. The package dry
run contains 208 permitted entries. The bounded blocked-file probe also passes.
The first Deno run reproduced one malformed-PEM startup failure because its
HTTPS implementation defers credential parsing until connection. Explicit key
and certificate parsing now occurs before binding and registration; the probe
in `experiments/telegraf-tls-validation.mjs` records that runtime difference.
Review additionally reproduced a custom context constructor identity failure;
the SDK three-argument constructor now retains its supplied Telegram instance.

[Nested Telegram roots and scoped settings](telegraf-transport-options.md) are
verified separately, followed by [agents and standalone construction](telegraf-agents.md).
Fully installed framework/cloud integration, controlled Telegram delivery and
all wider unfinished acceptance criteria remain open. These tests establish
local callback/server contracts.
