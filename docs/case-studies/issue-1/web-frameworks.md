# Installed webhook framework integration

Actual Express exposed a response bug missed by callback mocks: its Node
response also has a `send` method. Shared reply dispatch chose that method and
sent serialized JSON as `text/html; charset=utf-8`. Telegram expects a JSON
webhook response. Node response ownership now takes precedence when both `end`
and `setHeader` exist; pure callback envelopes retain their `send` contract.
The change preserves one-response ownership, SDK policies and selected-client
fallback. It adds no production framework dependencies.

The [reviewed facts](data/web-frameworks.json) record isolated exact versions,
installed package hashes, primary sources, finite limits and observed SDK
differences. All work belongs to [PR #2](https://github.com/link-foundation/anygram/pull/2)
and advances R01/R05/R08/R13/R16/R17/R19; the complete issue remains unfinished.

## Reproduction and verification

Install root dependencies and the isolated framework fixture, then execute:

```sh
npm ci --prefix experiments/bot-framework-runtime --ignore-scripts
node --test tests/bot-webhook-node-response.test.js
npm --prefix experiments/bot-framework-runtime test
```

Three core tests retain Node/envelope dispatch authority. Seventy-one real HTTP
cases compare installed frameworks with grammY 1.46.0 and Telegraf 4.16.3:

- Express 5.3.0, Koa 3.2.1 with @koa/bodyparser 6.1.0, Fastify 5.12.7,
  Hono 4.13.14 with @hono/node-server 2.1.5.
- Twenty-eight grammY comparisons across four frameworks: reply, empty response,
  wrong secret, simultaneous updates, handler failure, malformed JSON and body
  overflow at the framework parser.
- Twenty-one Telegraf comparisons across Express, Koa and Fastify using explicit
  Node response bridges where needed, with the same seven modes. Parsed reply
  objects are compared semantically; HTTP status and content type remain exact.
- Four owned serialized-update limits reject before middleware; sixteen SDK and
  owned deadline cases finish HTTP responses while a blocked handler remains
  pending, then release and await that handler before closing its server.
- Two Hono Fetch-adapter cases return an actual JSON object, avoiding the pinned
  Hono adapter's JSON-string result.

The same integration files run locally on Node 20.18.3, Node 26.12.1, Bun 1.4.4
and Deno 2.9.7. The following commands preserve each runtime's test discovery
and resolve isolated Node dependencies without weakening type checks:

```sh
bun test ./experiments/bot-framework-runtime/*.integration.js
deno test --no-config --node-modules-dir=manual --allow-read --allow-env --allow-net=127.0.0.1 experiments/bot-framework-runtime/*.integration.js
```

CI runs all 71 cases on each runtime across Linux, macOS and Windows. The release
job also requires this matrix. Platform success is recorded after fresh CI,
separately from these local Linux results.

The immutable pre-fix runner keeps current tests and loads only preceding reply
selection from commit `88f3c2e4a501169cecf4a6ad8476c942104040dc`:

```sh
node --loader ./experiments/web-framework-before-loader.mjs --test tests/bot-webhook-node-response.test.js experiments/bot-framework-runtime/telegraf.integration.js
```

It intentionally exits with four failures among 24 cases: two core response
authority failures and Express single/concurrent replies with the wrong content
type. Before implementation, both focused failures and both installed Express
failures were also observed directly. Current source passes all 24.

## Framework ownership and migration examples

[Executable bridges](../../../examples/webhook-frameworks.mjs) run inside the
integration tests against both actual SDKs. Express accepts the Node callback
directly after its JSON parser. Koa transfers its parsed body to `ctx.req`, sets
status 200 and disables its automatic response before giving the callback its
Node request/response. Fastify transfers the parsed body to `request.raw` and
uses its documented `reply.hijack()` before Node response ownership. Framework
parsers keep their own 16 KiB request limits in these fixtures.

For Hono, the Fetch adapter returns a Response without serializing its body
again:

```js
import { webhookCallback } from 'anygram';
import { honoFetchWebhook } from './examples/webhook-frameworks.mjs';

app.post(
  '/hook',
  honoFetchWebhook(
    webhookCallback(bot, 'cloudflare-mod', { secretToken: 'configured-secret' })
  )
);
```

This example assumes a configured `app` and `bot`; secrets should come from the
application's configuration. Install the relevant framework separately.

## Observed differences and limits

The pinned grammY Hono adapter calls the framework JSON encoder with a serialized
string; its compatible named adapter retains that behavior. The Fetch example
above is tested against both clients and returns a JSON object. These HTTP checks
do not claim that Telegram accepts the double-encoded form.

grammY's polling catcher does not handle webhook dispatch errors. The shared
Bot retains its existing direct-dispatch catcher extension. Tests unwrap the
original error at the HTTP boundary to compare framework error delivery; they
do not change that contract. Concurrent actual SDK callbacks can call `init`
twice before initialization settles, observed on Deno. The owned callback shares
one in-flight task; tests assert this difference explicitly.

Telegraf closes the Node response in a finally block even when middleware fails.
The compared callback therefore acknowledges with an empty response while the
test error boundary records the failure. The default callback does not promise
redelivery on handler failure. Application recovery and delivery guarantees
remain separate unfinished criteria.

Each test owns a local server and closes it in finally. Inputs are finite (the
largest request is 32,796 bytes), listeners allow at most 32 callback requests,
clients have 3-second abort deadlines, server requests have a 5-second limit,
idle sockets have 3-second limits and tests have 10-second deadlines. Body limits
after external JSON parsing bound serialized updates; they cannot undo parser
allocation. The fixture separately tests each framework's own parser limit.

This verifies the listed installed frameworks and local runtime contracts.
Other adapters' actual frameworks, cloud provider hosting, complete SDK plugins
and refined models, other runtime/platform integration, controlled Telegram
delivery and all wider open criteria in the requirement ledger remain unfinished.

## Clean CI dependency correction

Run 40954349985 tested head baff2293a7163ff9dfdd847dc14684c56bbeefe4,
created 2026-10-29T21:02:47Z after its 21:02:22Z commit. All six Node/Bun
framework jobs passed, while all three Deno framework jobs stopped during type
resolution: `Could not find a matching package for 'npm:@types/node'`.
Preserved job logs locate the error at macOS line 198, Windows line 201 and
Linux line 215. The isolated fixture now explicitly pins @types/node 22.18.3,
including its compatible undici declarations. A fresh Deno 2.9.8 installation
and empty DENO_DIR pass all 71 cases without disabling type checking.

The same run exposed a separate macOS Bun five-second timeout in the existing
10 MiB encrypted upload test (failed-run log lines 2304–2305). The input and
deadline remain unchanged; encryption allocation tracing is the next investigation.
Fresh matrix CI is required for both corrections before this checkpoint is verified.
