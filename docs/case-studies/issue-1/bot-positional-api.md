# Pinned grammY positional API translation

Most public helpers on `bot.api` previously fell through to the raw-object
proxy. For example, `bot.api.forwardMessage(7, 8, 9)` passed `7` as the payload
and lost the source chat and message. Of the initial 202 comparisons, 169 fail
before implementation and 33 preserve existing behavior. The failures are saved
in `ci-logs/bot-positional-before.log`.

The inventory records all 198 public methods on grammY 1.46.0's `Api` prototype.
`experiments/inspect-bot-signatures.mjs` parses the installed, size-bounded source
to collect public method names, argument names and raw-method/field mappings.
The factual JSON records version and SHA-256; it contains no implementation
bodies. The owned generator validates that pin, rejects unreviewed wrapper
shapes and produces compact runtime facts plus declarations. Regeneration is
checked by `npm run typecheck`. No SDK source is shipped in the package.

One owned translator constructs all positional payloads and sends them through
the already selected backend. Inline methods and deprecated aliases retain
their actual raw method names. Poll strings become option objects. Text-edit
helpers choose text or rich-message fields; owned formatted text retains its
existing entity conversion as an explicit extension. SDK option overrides are
preserved without mutating the input. Cancellation and request deadlines use
the existing shared operation pipeline. `getUpdates.timeout` remains Telegram's
long-poll duration in seconds rather than becoming a request deadline. A separate
request-options argument retains its signal and deadline on formerly raw
option-only helpers; the failing-before case is preserved in
`ci-logs/bot-positional-options-before.log`.

An added regression reproduces the compatibility risk introduced by replacing
raw fallthrough: `getChat({ chat_id: 7 })` would otherwise become a nested
`chat_id` object. Unambiguous raw objects containing all required fields remain
accepted, alongside positional calls. A positional profile-photo object with
its own `type` discriminator remains positional. Explicit `.raw` and `.callApi`
remain available for arbitrary or ambiguous payloads.

The generated declarations describe method names and argument counts; many
argument and return types remain `unknown`. They do not establish the complete
SDK type model. `examples/typed-positional-bot.ts` compiles positional, raw-object,
inline, alias, poll, rich-message and nested upload calls, including a rejected
missing-argument example.

## Verification

Run `node --test tests/bot-positional-api.test.js tests/bot-positional-wire.test.js`.
The comparison set invokes the actual pinned public SDK with its documented API
transformer and checks every mapped payload and signal. It also verifies the
complete public prototype inventory, rich-message branches, raw-object
compatibility, profile-photo ambiguity, long-poll timeouts, separate request options, owned
formatted text, poll preparation bounds and option overrides.

The independent local HTTP fixture exercises ten representative methods/forms
through each of native, grammY, Telegraf and current node-telegram-bot-api
automatic constructors. It checks positional fields, nested JSON, aliases,
inline routes, raw objects, immutable arguments and pre-cancellation without a
request. Separate cases verify a deadline interrupts blocked nested album input
preparation before each selected backend dispatches. Fixtures bound request
count, body size and socket lifetime; blocked sources are explicitly released.
No Telegram account or credentials are used.

This checkpoint covers pinned grammY API argument translation. Complete
Telegraf context/event APIs, context shortcuts, plugin/model behavior,
Telegram-server semantics and the other issue criteria remain unfinished.

All 217 focused cases pass on Node 20.18.3. All 974 core cases pass on Node,
Bun and Deno. Strict ESLint, formatting, full declaration/example compilation,
exact schema and positional regeneration pass. The repaired duplication gate
scans 87 production sources with zero clones. All 26 native terminal checks,
two actual Telegraf Node 20 wire cases and the bounded Linux FIFO probe pass.
The npm dry run contains 130 permitted entries. Fresh main is an ancestor.
