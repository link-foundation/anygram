# Filter and checker declarations

This work advances R01/R05/R08/R13/R16/R17/R19 in
[issue #1](https://github.com/link-foundation/anygram/issues/1), within
[PR #2](https://github.com/link-foundation/anygram/pull/2).

The preceding runtime correctly filters updates, but its declarations leave
selected message/query fields optional and permit invalid query strings. A
`message:text` handler therefore cannot read `ctx.message.text` as a string
without additional checks. Checker predicates also fail to refine contexts.

## Independently owned types

The reviewed public filter facts already used by the runtime compiler now
generate a finite `FilterQuery` union and typed grammar facts. There are 1,140
concrete paths and 1,908 spellings after shortcut expansion. The generator
rejects stale content and unexpected numbered output files. Production types
do not import SDK implementations or declarations.

The type-level resolver expands shortcuts, discards impossible expansions,
selects update fields and preserves correlated alternatives. It requires the
same implied fields as the pinned grammY contract: message senders, edit dates,
channel sender chats, animation documents, live-photo photos, entity text,
caption text and topic identifiers. Context aliases and aggregate accessors
follow the owned runtime's source order. Custom context properties survive
scoped registration and predicate guards.

`Composer.on`, command/text/reaction/query helpers, `matchFilter`, static
`Context.has` factories and instance checkers now expose these refinements.
Chat-type checks constrain the chat and nested update aliases, preserve the
four documented types, require private-chat senders and exclude incompatible
message/channel-post sources. Exported context helper types support handlers
declared in separate modules. The additional `action` alias uses callback-query
scope.

A broad, unknown query remains an unrefined context. Enumerated query spellings
are precomputed in seven small declaration groups. An earlier experimental
design expanded all query combinations during generic Composer comparisons and
approached the container memory limit; that compiler was stopped. The final
design avoids that expansion and is checked with strict library compilation.

## Reproduction and verification

`examples/typed-filter-narrowing.ts` contains portable positive and negative
assertions for selected fields, aggregate getters, implied fields, correlated
unions, all checker kinds, scoped helpers and custom contexts. Invalid names,
four-level queries, impossible entity flags and invalid chat types must fail.

```sh
node experiments/composer-fluency-check.mjs --filters --before
node experiments/composer-fluency-check.mjs --filters
```

The first command reproduces 80 diagnostics with the preceding declarations at
`4d6c1ca33b62a06500312a106e2638a9f80b66d0`; the second compiles the same fixture
against the current declarations. Temporary directories are removed on both
paths.

The complete `FilterQuery` union is compared with grammY 1.46.0. A generated
copy of the public fixture compiles against that actual SDK, with no skipped
library checks. The dedicated configuration uses pinned Node and node-fetch
ambient types rather than the unrelated historical types pulled by release
tooling. It also verifies that a callback-only Composer cannot be widened to
promise handlers for arbitrary updates. CI installs these isolated development
types and runs the comparison. Fixture regeneration is part of the normal
typecheck gate.

```sh
npm ci --prefix experiments/composer-types-runtime --ignore-scripts
node node_modules/typescript/bin/tsc --project experiments/tsconfig.bot-filters.json
node --test tests/filter-query-grammar.test.js
```

The runtime regression independently enumerates every accepted spelling and
compares an absent update and a concrete matching witness against actual
grammY. Existing full filter/checker comparisons remain intact.

All 2,007 core tests pass on Node, Bun and Deno. Strict lint, formatting,
declaration/example compilation and exact regeneration pass. Both focused
runtime cases also pass on Node 20. The duplication
gate scans 138 production sources with zero clones. The package dry run contains
181 permitted entries, including all twelve new declaration files and no
research or development-only SDK type dependencies.

## Remaining acceptance criteria

This checkpoint covers grammY-style filter and checker declarations. Complete
Telegraf update-predicate refinements, SDK-specific public message/chat subtype
names, per-method argument/result models, framework plugins, webhook responses
and the wider account/application/live-interoperability requirements remain
unfinished. Grammar equality and passing type fixtures do not establish those
separate requirements.
