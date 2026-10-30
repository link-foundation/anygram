# Pinned Telegraf positional API

The initial 130 comparisons reproduce 109 failures: most Telegraf helpers fell
through to a raw object proxy and discarded positional arguments. For example,
`telegram.forwardMessage(7, 8, 9)` lost its source chat and message ID. The
failing run is retained in `ci-logs/telegraf-positional-before.log`.

`experiments/inspect-telegraf-signatures.mjs` inventories all 125 public members
of the actual Telegraf 4.16.3 Telegram prototype. The bounded source has SHA-256
`664b6feea3b89d2490bdd6c3bfc9887568d4907c7eb58e2a94afeae67b6bb788`.
The archived JSON contains public argument names, defaults, aliases and ordered
field mappings, without SDK implementation bodies. An owned generator validates
that pin and emits compact runtime facts and argument tuples. Exact regeneration
is part of `npm run typecheck`; the published package contains no SDK source.

One owned translator maps these arguments through the shared selected-backend
operation path. It retains aliases, inline-edit fields, copy/invoice objects,
destructured menu options, default booleans, actual option precedence and
Telegraf formatted text/captions. Unambiguous raw objects remain usable. Explicit
`.callApi` and `.raw` accept arbitrary payloads. Caller objects are not mutated.
Embedded `{ signal, timeout }` and a separate final request argument share the
existing cancellation boundary. Undefined final controls retain embedded ones;
a separate failing-before regression demonstrates that precedence error.
`getUpdates.timeout` remains Telegram's long-poll duration in seconds.

`getFileLink` accepts a file ID or existing metadata. The canonical operation
looks up missing metadata through the selected backend and constructs a URL from
private token/server configuration. It preserves native server path prefixes,
Telegraf API mode/test environment and absolute local file paths. Automatic
constructors pass their public server options; injected adapters accept explicit
`fileOptions`. A custom grammY URL builder requires an explicit file root rather
than guessing its file-server route. Cached metadata needs no request and honors
pre-cancellation. The owned file configuration stays private during JSON
serialization, which invokes no raw RPC. Initialized SDKs retain their own fields;
the independently discovered [proxy serialization defect](proxy-serialization.md)
has its own bounded regression and fix.

Telegraf resolves relative file URLs against its API root as a URL, whereas the
native server retains its configured path prefix. A further failing-before case
checks roots with a path and no trailing slash. Automatic Telegraf construction
now retains that exact relative-base behavior; explicit file roots and the native
prefix behavior remain distinct and tested.

The generated declarations preserve public names, argument counts, defaults and
the file-link URL result, using one shared callable type. Many arguments/results
remain `unknown`; full SDK type models and every context shortcut remain open.
`examples/typed-telegraf-api.ts` checks representative calls and rejects missing
forwarding IDs.

## Verification

Run `node --test tests/telegraf-positional*.test.js tests/bot-file-links.test.js`.

The 133 API cases invoke the actual pinned public SDK with a stubbed public
`callApi`, comparing every member's JSON payload and the complete prototype
inventory. Added cases cover defaults, option overrides, text/caption entities,
copy/media edits, raw objects, URL behavior and cancellation for every RPC helper.

Eight HTTP cases exercise automatic native, grammY, Telegraf and current
node-telegram-bot-api backends. Each sends twelve representative requests to an
independent bounded local peer. They check exact fields, aliases, quiz strings,
invoice/menu/copy objects, inline fields, game defaults, file lookup, raw access,
immutable inputs and pre-cancellation. Separate cases bound a blocked nested
upload before backend dispatch and release its source after the deadline.

Eight additional metadata-only cases compare actual Telegraf URL variants and
exercise native prefixes, grammY test URLs/custom builders, explicit injected
configuration and serialization privacy. A further failing-before regression
verifies that directly constructed contexts retain the configured transport
helper; the previous wrapper discarded it. The same case exercises a context
built from the shared `bot.api` view, which now exposes the canonical helper
rather than dispatching a synthetic `getFileLink` RPC. Middleware-only context
construction remains lazy. These tests contact no Telegram server
and require no account credentials. The 149 cases pass locally; the separate
proxy serialization tests add two more regressions. Strict checks pass with zero
clones across 90 production sources and exact schema/method regeneration. All
1,140 core cases pass on Node, Bun and Deno; the 151 focused cases, including the
proxy regressions, also pass on Node 20.18.3. The npm dry run has 133 permitted
entries and excludes SDK dependencies and research files.

The initialized-adapter case also uses the actual Telegraf Telegram client with
separate SDK and explicit file-server credentials. Its first run showed that the
SDK helper bypassed the explicit configuration. The adapter now uses the shared
operation for configured file links, retaining private file credentials and
pre-cancellation; the owned native helper remains usable without extra settings.

This advances R01/R05/R08/R13/R16/R17/R19. Full context/filter/plugin/model
compatibility, the newer-runtime vendor multipart encoder, production Telegram
behavior and every other open issue criterion remain unfinished.
