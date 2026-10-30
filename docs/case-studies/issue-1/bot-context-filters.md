# Context filters, entities and reaction views

Work for [issue #1](https://github.com/link-foundation/anygram/issues/1) stays in
[PR #2](https://github.com/link-foundation/anygram/pull/2). This comparison covers
context inspection against installed grammY 1.46.0 and Telegraf 4.16.3.
Composer registration/scoping and complete SDK type narrowing remain open.

## Reproduction and source facts

The preceding context entry, commit
`a008885d17aa9b564b3a172f02e7c4435ccd2a6a`, has no context checker factories,
entity extraction or reaction summaries. Telegraf also lacks text, reaction
views, passport/web-app data and webhook aliases. Its username alias cannot
follow a reassigned `botInfo`.

The first 97 actual-SDK cases fail 96 assertions. Two additional utility cases
then fail against the first implementation; a separate webhook-control case
reproduces a dynamic API proxy returning a callable for a data property.
The final 104-case suite reproduces 102 failures and two passes with this
immutable loader:

```sh
node --loader ./experiments/context-filters-before-loader.mjs \
  --test tests/bot-context-filters.test.js
```

Actual SDKs and the assertions remain current. Only `src/bot-context.js` comes
from the fixed preceding revision. The two passing assertions inventory the
reference SDK and exercise the separately exported reaction-list class.

`experiments/inspect-context-filter-facts.mjs` reads declarative keys and
shortcuts from the pinned SDK through a restricted AST reader. It evaluates
only object/array/literal/identifier facts and object spreads. It archives
25 interned key groups in
[the primary facts file](data/grammy-filter-facts.json), including the original
source SHA-256 `f68dde2272adbb079f27ddf7c30a111e80847f35ba449adaca08eddaac84d46a`.
The independent compiler contains no copied SDK implementation. Generation
checks the reviewed version/hash pin; `npm run typecheck` verifies exact output.

## Behavior compared

The suite covers all **1,140 concrete filter paths** across 27 update kinds,
including scalar/array flags, entity types, user flags and the `me` shortcut.
It checks non-null leaf semantics, false/zero/empty values, L1/L2 shortcuts,
three-level validation errors and the pinned SDK's merging of broad/narrow
paths. These queries share one independent compiler and the exported
`matchFilter` utility. Registration is limited to 1,000 queries of at most
4,096 characters; the compiled-predicate cache retains at most 128 entries.
Eviction does not invalidate already returned predicates. Prototype names
are not accepted as Telegram filter keys.

All 11 grammY static checker factories and corresponding instance helpers
compare directly against actual contexts. Tests cover exact/regex/array
triggers, string versus regex `match`, command entity offsets and usernames,
caption/channel behavior, newly added reactions, paid/custom reactions and
registration snapshots. Public static checker hooks remain effective.
Telegraf `has` accepts update-kind strings and predicates of the raw update,
including property-presence semantics and short-circuit ordering.

Entity extraction retains each style's source and signature. grammY uses
message text/caption and returns each entity with `text`; Telegraf also reads
game text and poll explanations, accepts variadic entity kinds and returns
`fragment`. UTF-16 offsets, nullish values, empty arrays, captions and source
precedence are compared without mutating updates. grammY reaction summaries
retain duplicate/order semantics and the actual returned paid fields.
Telegraf reaction views retain indexing, iteration, copies, object identity,
dynamic old/new lists, filtering, membership and inspection formatting.

Telegraf passport and web-app aliases retain original message scope. Web-app
JSON parsing remains lazy, including its original parse failures. Telegram
and webhook-control aliases share public object state. `botInfo` replacement
updates the username alias. The webhook control defaults to the pinned API's
boolean value and cannot dispatch a synthetic API call. This property does
not establish Telegraf's optional HTTP webhook fast-response behavior, which
remains a separate open framework requirement.

## Validation

```sh
node --test tests/bot-context-filters.test.js
npm run check
node node_modules/eslint/bin/eslint.js . --max-warnings 0
npm test
bun test
deno test --allow-read --allow-write --allow-env --allow-net=127.0.0.1 --allow-run=git
npm exec --offline --package=node@20.18.3 -- node --test tests/bot-context-filters.test.js
```

The focused suite passes 104 cases. The checked
[TypeScript example](../../../examples/typed-bot-context-filters.ts) exercises
both context styles, every checker, the standalone compiler, entity result
fields and reaction views. Final runtime, packaging and CI evidence is recorded
in the work plan and requirement ledger after the corresponding checks finish.

All 1,884 core tests pass on Node, Bun and Deno. The 104 focused cases also
pass on Node 20. Strict lint/format/type/regeneration checks pass, with zero
clones across 111 production sources and 154 permitted package entries.
All 26 isolated native terminal checks, two actual Telegraf Node 20 wire cases
and the bounded FIFO cleanup probe pass. Main remains an ancestor of the branch.

Every pinned context member is now represented at runtime. This inventory
assertion is evidence of member presence, not complete framework/model parity.
Full filter type narrowing, Composer scopes, plugin behavior, controlled
Telegram interoperability, downstream application coverage and all other open
issue criteria remain unfinished.
