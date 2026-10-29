# Query registration and scoped filters

The six grammY query shortcuts were missing from the shared composer. Migrating
`bot.callbackQuery('refresh').use(handler)` threw before registering a handler.
The initial nine comparisons fail before implementation in
`ci-logs/bot-query-before.log`.

`callbackQuery`, `gameQuery`, `inlineQuery`, `chosenInlineResult`,
`preCheckoutQuery` and `shippingQuery` now share an asynchronous filter and query
matcher. Each returns a scoped composer, so handlers registered later on that
branch run only for matching updates. Exact strings retain grammY's string
`ctx.match`; regular expressions retain native `String.match` arrays, including
global and sticky expression state. Arrays are copied at registration. A bounded
array check runs before accessing entries, with its failing-before regression in
`ci-logs/bot-query-bounds-before.log`.

Missing chosen-result and payment-query context aliases retain their original
update objects. Sender lookup includes those query types. Predicate failures
enter the existing bot recovery boundary and successful recovery acknowledges the
update once. The existing `action` registration remains available.

Run `node --test tests/bot-query-composer.test.js tests/bot-query-wire.test.js`.
The eleven composer cases compare the actual pinned grammY implementation for
all six shortcuts, exact matches, expression flags, array snapshots, asynchronous
predicates and later scoped registrations, plus owned bounds and recovery
behavior. Four local HTTP cases use the actual automatic native, grammY,
Telegraf and node-telegram-bot-api backends. They verify acknowledgement and edit
payloads, cancellation controls, immutable updates and duplicate-update handling.
Request count, body size and socket lifetime are bounded. No Telegram credentials
are used. `examples/typed-bot-queries.ts` compiles all six shortcuts and their
context aliases.

All 989 core tests pass on each of Node, Bun and Deno. The fifteen focused cases
also pass on Node 20.18.3. Strict ESLint, formatting, complete declaration/example
compilation and exact generation checks pass. The duplication gate scans 87
production sources with zero clones. All 26 isolated native checks, two actual
vendor wire cases on Node 20 and the bounded Linux FIFO probe pass. The package
dry run contains 130 permitted entries. Fresh main remains an ancestor.

These comparisons cover query registration. Full filter-language, context,
framework plugin and type-narrowing compatibility remain open alongside the
other issue requirements.
