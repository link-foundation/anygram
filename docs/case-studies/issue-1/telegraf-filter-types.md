# Telegraf registration and checker declarations

This work advances R01/R05/R08/R13/R16/R17/R19 in
[issue #1](https://github.com/link-foundation/anygram/issues/1), within
[PR #2](https://github.com/link-foundation/anygram/pull/2).

The preceding declarations preserve fluent registrations but leave their
callback update fields optional. For example, `on('text', handler)` does not
allow the handler to read `ctx.message.text` as a string. Raw update predicates,
static factories and `ctx.has` also fail to narrow their contexts.

## Implementation

Telegraf registrations now select raw update names, legacy message subtypes or
type-guard predicates. Update arrays retain correlated alternatives. Selected
aliases and message/chat/user getters follow Telegraf's runtime source order,
including its different handling of business updates and chat boosts. Custom
context members and fluent subclass/scene receivers remain available.
Guards that constrain only an update identifier retain optional message fields;
they do not invent an absent-message guarantee.

Shared, independently owned payload refinements preserve required message
senders, edit dates, channel sender chats and implied content fields. Telegraf
selects these payloads directly; it does not expand the grammY query grammar
while comparing generic registrations. An initial generic query-based version
was stopped after excessive compilation cost. No SDK declarations are imported
by production code, and existing grammY refinements use the extracted shared
accessor machinery.

Text, action, inline, game, reaction and command callbacks receive the selected
updates. Command/start handlers receive required command fields and start
payloads; entity helpers retain their message/channel-post alternatives.
Static factories use the same callback scopes. `NarrowedContext` supports
separately declared raw-update handlers. `ctx.has` is a type predicate and
message `has` checks require the selected field; multiple message keys represent
alternatives because the runtime checks whether any key is present.

The existing extensions for boolean raw-update predicates, additional Bot API
fields and reaction objects remain available. Unknown update names and message
fields are rejected. Object reaction matches remain typed as reaction objects.
The Telegraf sender-chat getter can return `false` when an existing message has
no sender chat; its refinement retains that runtime possibility.

## Reproduction and verification

`examples/typed-telegraf-filters.ts` is a portable positive/negative fixture.
Its generated counterpart compiles against pinned Telegraf 4.16.3 with strict
library checking. It checks instance/static registrations, raw guards, arrays,
custom contexts, subtype fields, command fields, checker predicates, entity
helpers and separately declared narrowed handlers. Both SDK fixtures regenerate
using the repository's formatting settings.

```sh
node experiments/composer-fluency-check.mjs --telegraf-filters --before
node experiments/composer-fluency-check.mjs --telegraf-filters
node node_modules/typescript/bin/tsc --project experiments/tsconfig.bot-filters.json
```

The first command freezes the preceding public declarations at
`bebfa138ce830b9d5453fd974e3a80849fd19120` and produces 69 diagnostics. The
second compiles the same program against the current declarations. Temporary
declaration trees are removed after success or failure. The strict SDK
comparison runs in CI alongside the complete grammY grammar comparison.
`examples/typed-composers.ts` additionally checks owned reaction-object and
sender-chat extensions that are not shared SDK promises.

All 2,007 core tests pass on Node, Bun and Deno. Strict lint, formatting,
exact regeneration and declaration/example checks pass. The duplication gate
scans 140 production sources with zero clones; packaging permits 183 entries.

## Remaining acceptance criteria

These fixtures verify the covered declaration contracts. SDK-specific public
message/chat subtype namespaces, per-method argument/result models, remaining
framework integrations, webhook responses and the wider account/application/
production-interoperability criteria remain unfinished. Successful compilation
does not demonstrate complete framework or protocol parity.
