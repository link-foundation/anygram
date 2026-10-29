# Webhook framework adapters

This advances R01/R05/R08/R13/R16/R17/R19 in
[PR #2](https://github.com/link-foundation/anygram/pull/2). The preceding callback
only accepted a Fetch request. All 22 pinned grammY 1.46.0 adapter names now have
owned implementations sharing initialization, authorization, response ownership
and deadline handling:

`callback`, `aws-lambda`, `aws-lambda-async`, `azure`, `azure-v4`, `bun`,
`cloudflare`, `cloudflare-mod`, `elysia`, `express`, `fastify`, `hono`, `http`,
`https`, `koa`, `next-js`, `nhttp`, `oak`, `serveHttp`, `std/http`, `sveltekit`,
and `worktop`.

```js
const callback = webhookCallback(bot, 'http', {
  secretToken: 'secret',
  timeoutMilliseconds: 10000,
  onTimeout: 'throw',
  maxBytes: 1024 * 1024,
});
// Pass callback to an application's existing HTTP server.
```

Custom adapters retain their request argument tuple and `handlerReturn` result.
Both options objects and positional timeout/secret arguments are supported.
With the adapter omitted, the callback accepts the pinned SDK's default Express
pair as well as the existing native Fetch API. The original `webhookCallback(bot, options)`
Fetch path retains its HTTP status/error behavior; use a named Fetch adapter to
apply framework initialization and timeout controls. Creating a framework
callback prevents subsequent polling while preserving Telegraf's `/start`
registration API.

Initialization is shared across concurrent callbacks and retried after failure.
Authorization precedes reading the body. Framework callbacks default to a
10-second deadline, including initialization and body reading. `onTimeout`
accepts `throw`, `return`, or a function receiving the original callback
arguments. Expiration retires the response before invoking the timeout handler;
late middleware cannot send a second response. These controls cannot cancel
arbitrary application initialization, middleware or custom adapter promises.

The owned `maxBytes` extension caps raw Node/Fetch collection and the serialized
form of preparsed updates before middleware dispatch. It does not undo parsing
already performed by a framework. Node aborts and parse/limit failures release
owned listeners. Fetch streams receive best-effort cancellation on failure or
expiration. Application server code chooses its HTTP error response when a named
adapter rejects. Framework-specific response shapes intentionally match the
actual SDK, including Hono/Next/Azure-v4 handling of the serialized JSON string.
The async Lambda return type describes its observed object result more precisely
than the pinned SDK's `void` declaration.
The owned declarations also accept explicitly passing `undefined` for the
default adapter with either options form, as the SDK runtime does. The pinned
SDK declarations reject these calls; a checked difference fixture preserves
that distinction separately from the portable examples.

```sh
node --loader ./experiments/webhook-framework-before-loader.mjs --test \
  tests/bot-webhook-frameworks.test.js
node --test tests/bot-webhook-frameworks.test.js \
  tests/bot-webhook-lifecycle.test.js tests/bot-webhook-streams.test.js
node experiments/composer-fluency-check.mjs --frameworks --before
node experiments/composer-fluency-check.mjs --frameworks
```

The immutable loader freezes the runner and reply code at preceding head
`b73f33041ba5ac00895d4b808ecd48947c33de4f`. All 67 final comparisons fail there:
reply/empty/unauthorized for each adapter plus authoritative method selection.
The current code passes those cases and 23 additional lifecycle/stream cases.
Five use real bounded Node sockets for reply, empty, unauthorized, malformed and
oversized requests. Initial cleanup probes independently reproduce uncancelled
Fetch overflow and Node aborts falling through to the deadline. Checked portable
examples compile against both owned and pinned actual-SDK declarations; frozen
public declarations produce 35 diagnostics. The observation script
`experiments/webhook-framework-observe.mjs` records all 66 SDK response scenarios.

Framework-shaped test objects establish the public callback contract, not full
integration with separately installed framework versions or cloud hosting.
Complete server lifecycle, controlled Telegram delivery, other SDK features and
all wider unfinished issue criteria remain open.

Final local checks pass all 2,143 core tests on Node, Bun and Deno, 27 isolated
native terminal checks and six Node 20 wire checks. Strict gates scan 162
production sources with zero clones; packaging includes 205 permitted entries.
The bounded blocked-input probe and all 16 official fact-parser checks pass.
Main remains an ancestor and all four issue/PR feedback streams remain empty.
