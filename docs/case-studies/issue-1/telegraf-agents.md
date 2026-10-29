# Telegraf agents, URL uploads and standalone construction

R01/R05/R08/R13/R16/R17/R19 require existing construction and transport options
to work through real connections. Retaining an agent in an options object did
not fulfill this contract: the preceding native transport used global Fetch,
which ignores Node HTTP agents. Standalone `Telegram` was also missing at
runtime, although the root exported a model namespace with that name.

The pinned primary contracts are Telegraf 4.16.3's
[client implementation](https://github.com/telegraf/telegraf/blob/v4.16.3/src/core/network/client.ts),
Node 20.18.3's [HTTP agent contract](https://nodejs.org/download/release/v20.18.3/docs/api/http.html#class-httpagent)
and its [Web stream bridge](https://nodejs.org/download/release/v20.18.3/docs/api/stream.html#streamreadabletowebstreamreadable-options).
[Archived facts](data/telegraf-agents.json) preserve source URLs and installed
implementation/declaration hashes; `experiments/record-telegraf-agent-facts.mjs`
refreshes that evidence. No vendor implementation is copied into production.

The shared Telegraf factory now exposes the SDK's HTTPS keep-alive agent,
including its shared pool and ten-second keep-alive interval. HTTP API roots
clear the API agent during construction, matching the SDK even for a supplied
agent. Each update copies settings while retaining the selected agent identity;
changing one context's agent leaves the global and next context settings intact.

An internal Node HTTP bridge lets API agents control actual requests. A separate
attachment fetch uses `attachmentAgent`, including URL selectors evaluated for
each redirect. Native source readers retain their aggregate upload budget,
deadline and cancellation behavior. Response readers retain byte/chunk limits;
the stream bridge uses a byte-counted 64 KiB queue. Gzip, deflate and Brotli are
decoded before the byte limit is enforced. Redirects stop after twenty hops.
Selected backends and explicit custom Fetch hooks retain transport authority.
Caller-supplied agents remain caller-owned; the library does not destroy them.

Telegraf `{ url, filename }` uploads pass through the shared bounded upload
collector and readers. Only upload-bearing field names accept these wrappers,
including nested media and thumbnails. An executable inventory checks all
thirteen names against the pinned official method/model facts. Ordinary wire
objects such as `web_app: { url }` and link-preview options remain unchanged.
The owned URL-wrapper type is also available through canonical/other bot styles
that share the same collector. Missing filenames use the URL-derived owned
default; explicit filenames match the SDK wire comparisons.

`new Telegram(token, options, response)` uses the same transport, positional
methods, mutable settings and webhook scope as `Telegraf`. Its optional response
receives the first eligible webhook reply, with subsequent operations using
the selected transport. Global and scoped bot views satisfy `instanceof Telegram`,
and subclasses retain their prototype, method overrides and `super` delegation.
Inherited positional methods call overridden `callApi`, and file links resolve
through overridden `getFile`, as in the SDK. Readonly token/options/response metadata
is declared without requiring Node ambient types. Native constructor extensions
include selected `api`, Fetch hooks, deadlines and byte limits.

The runtime constructor shares its exported name with the existing model types.
Generated declaration aliases retain all 402 model/interface names, including
nested `Telegram.Message.TextMessage`, chat and entity subtype namespaces.
`generate-telegram-constructor-types.mjs --check` prevents namespace drift.
The [agent example](../../../examples/typed-telegraf-agents.ts) and
[constructor example](../../../examples/typed-telegram-constructor.ts) compile
against both current declarations and the actual SDK. A separate fixture checks
real Node HTTP/HTTPS agents; the
[namespace example](../../../examples/typed-telegram-namespace.ts) checks that
existing model refinements survive beside the new value export.

The initial twelve agent cases reproduced ten failures before implementation;
two URL-wrapper cases and six constructor cases also failed first. The final
immutable comparison freezes every affected runtime file at
`ce24156ce1d785a995036d1557fae97962df21d6`. The final 37 cases reproduce 34 failures
against that frozen runner. Frozen declarations reproduce 21
diagnostics. Reproduce the comparisons with:

```sh
node --loader ./experiments/telegraf-agents-before-loader.mjs --test tests/telegraf-agent.test.js tests/telegraf-url-upload.test.js tests/telegram-constructor.test.js
node --test tests/telegraf-agent.test.js tests/telegraf-url-upload.test.js tests/telegram-constructor.test.js
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --telegraf-agents --before
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --telegraf-agents
npm exec --offline --package=node@20.18.3 -- node --test experiments/vendor-bot-wire.integration.js
```

Finite HTTP/TLS fixtures enforce request/body/idle limits and always close their
servers and caller-owned test agents. Tests observe cancellation and overflow
disconnects before fixture cleanup, including attachment cancellation before
opening an API connection. Both top-level and nested actual SDK multipart URL
uploads use a separate CA agent on the Node 20 wire runner, with equal bytes,
filenames and selector calls. This supplements portable owned multipart tests.

Bun 1.4.4's actual Telegraf `node-fetch` shim bypasses `Agent.addRequest` for the
JSON comparison. The test asserts that observed difference and verifies the
owned bridge invokes the agent. It does not treat the SDK's bypass as parity.
The previously recorded actual SDK multipart stall on newer Node/Bun remains
open; the successful Node 20 comparison does not resolve it. Complete proxy
families, all SDK construction edge cases, installed-framework/cloud scenarios,
controlled Telegram delivery and every wider unfinished criterion remain open.

Final local validation passes all 2,260 core tests on each of Node, Bun and Deno,
27 native terminal checks, eight Node 20 actual vendor/terminal wire checks,
sixteen official fact-parser checks and the bounded Linux FIFO probe. Strict
ESLint, formatting, declaration/example compilation and exact generation pass;
the duplication gate scans 168 production sources with zero clones. Actual-SDK
fixtures compile with real Node agents and subclass delegation. The package
dry run contains 211 permitted entries. Main remains an ancestor; all four
feedback streams remain empty. GitHub rejects the complete PR diff above its
300-file limit; the paginated inventory has 881 files and no deletions, and the
complete atomic diff and every new fixture/example were reviewed locally.
