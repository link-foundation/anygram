# Context operation result declarations

This checkpoint advances R01/R05/R08/R13/R16/R17/R19 in
[issue #1](https://github.com/link-foundation/anygram/issues/1), within
[PR #2](https://github.com/link-foundation/anygram/pull/2).

Context delivery, administration, services and message actions previously erased
their known operation results to `unknown`. For example, reading `file_id` after
`await ctx.getFile()` failed even though the corresponding positional operation
already had its official wire result.

Scoped operations now carry both their existing argument tuple and result from
the same positional operation. Delivery aliases select their canonical send
operation; forwarding, copying, inline edits, reactions and direct helpers retain
their respective message, message-ID, model or true results. Request controls,
argument stripping and runtime implementations are unchanged. Persistent chat
action callbacks retain their arbitrary callback return values.

## Reproduction and SDK comparison

The checked grammY and Telegraf context examples exercise delivery, copy/forward,
edits, polls, reactions, deletion, callbacks, administration, topics, files,
payments and configuration. Negative assertions check identifiers and reject
incorrect result assignments. An inferred file/sticker property access verifies
that a contextual annotation is unnecessary.

```sh
node experiments/composer-fluency-check.mjs --context-results --before
node experiments/composer-fluency-check.mjs --context-results
node node_modules/typescript/bin/tsc --project experiments/tsconfig.bot-filters.json
```

The first command freezes the preceding declarations at
`2dbc782abe55d2251a323fbc7628c93491ae7200` and reproduces 49 diagnostics, all
inside the two fixtures. The second compiles the same fixtures against current
declarations. Both remove their temporary declaration trees. Generated copies
also compile against actual grammY 1.46.0 and Telegraf 4.16.3 with strict library
checking and pinned ambient dependencies in the existing CI gate.

The pinned Telegraf `getUserChatBoosts` declaration specifies an array, although
its runtime directly forwards the Bot API object. The owned declaration retains
the official object contract. A separate checked fixture asserts both different
types explicitly. Caption edits retain the previously documented comparison
limit: the SDK result is not assignable to its own complete `Message` union, so
the portable example checks common message ID/chat fields or true. These are
documented differences, not evidence of full refined-result parity.

All 2,007 core tests pass on each of Node, Bun and Deno. Strict repository checks
and exact generation pass. The unchanged duplication gate scans 151 production
sources with zero clones; the package contains 194 permitted entries. Main is
an ancestor, all four feedback streams remain empty, and the declarations,
fixtures and atomic diff were reviewed. GitHub's 300-file diff limit is preserved
in the local log; the paginated file inventory and local diff support review.

## Remaining acceptance criteria

This change carries official wire models through context calls. SDK-specific
message/chat subtype names and stronger conditional result refinements, manual
media/edit argument declarations, framework integrations, webhook fast responses
and the wider account/application/interoperability criteria remain unfinished.
