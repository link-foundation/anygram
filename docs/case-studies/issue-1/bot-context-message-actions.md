# Context message actions

This change binds all 29 pinned grammY 1.46.0 and 14 pinned Telegraf 4.16.3
message action helpers, plus Telegraf's persistent chat action, through existing
shared positional APIs. Independent arguments and 17 event shapes live in
[`tests/fixtures/context-message-actions.js`](../../../../tests/fixtures/context-message-actions.js).
Inventory assertions check actual SDK prototypes. Immutable SDK source
fingerprints are recorded in [the delivery comparison](bot-context-delivery.md).

## Reproduction

The initial 100-case comparison reproduces 98 failures at preceding head
`d76b83cbd5495042405a4951c890317032ceecd7`. Two inventory assertions pass.
Most helpers are absent; the earlier text edit and deletion methods also lose
required-scope errors, reaction identifiers or public override calls.
Three further cases reproduce absent persistent-action lifecycle behavior.

The final 119-case suite reproduces 117 failures and two passes with the original
context entry, retaining actual SDKs and every current assertion:

```sh
node --loader ./experiments/context-actions-before-loader.mjs \
  --test tests/bot-context-message-actions.test.js
```

The loader uses a fixed Git revision and a 64 KiB source bound. Local evidence is
preserved in `ci-logs/context-actions-before.log`,
`context-actions-variants-before.log` and `context-actions-before-complete.log`.

## Scope and behavior

One owned binding module chooses identifiers and delegates request translation
to the selected positional API. Edit helpers retain each SDK's distinct inline
signature; grammY edits also derive business connections and reaction message
identifiers. Forward/copy helpers derive the source chat/message and grammY's
direct-message topic, while caller options retain precedence. Checklist edits
prefer the referenced completed checklist, then the added-task checklist, then
the current message. Ephemeral operations require their receiver and ephemeral
identifier. Missing fields retain original SDK errors and assertion hooks.

Reaction normalization preserves the SDK difference: grammY treats string
reactions as ordinary emoji; Telegraf treats strings beginning with an ASCII
digit as custom emoji IDs. Empty and mixed inputs have direct comparisons.
Reaction deletion retains dynamic context-method overrides and actor precedence.
Suggested-post operations, bulk deletion and business deletion share existing
RPC operations. Existing explicit-message deletion and request-option extensions
remain available alongside grammY's signal-only signature.

Rich-edit tests use actual SDK inputs: grammY rich-message objects and Telegraf
formatted strings. Anygram's existing text-with-entities extension remains.
Tests do not equate grammY's `deleteMessage(0)` signal position with anygram's
separately supported explicit message identifier.

Persistent chat actions await the initial send, ignore repeated send failures,
await the callback and clear the interval after success or failure. Bounded
tests compare all three lifecycle paths against actual Telegraf. The optional
`onError` diagnostic callback reports repeated failures and defaults to disabled;
a diagnostic failure cannot reject the application callback or escape as an
unhandled rejection. Diagnostic fields never enter the Telegram payload.

The 119 focused cases cover public API override arguments, zero IDs, caller
overrides, immutable inputs, every helper's cancellation and pre-cancellation,
eight selected-backend HTTP cases and eight independently bounded media-source
deadlines. HTTP cases compare forwarding, reactions, bulk deletion and inline
editing through actual native, grammY, Telegraf and node-telegram-bot-api backends.
The [checked example](../../../../examples/typed-bot-context-message-actions.ts)
retains SDK-specific context signatures and shared request controls.

All 1,780 core cases pass on Node, Bun and Deno. The 119 focused Node 20
cases, strict static gates, exact declaration regeneration, 26 native integration
checks, two vendor wire cases and bounded FIFO probe pass. The scan covers 102
production sources with zero clones; the package contains 145 permitted entries.
Main remains an ancestor of the branch.

Context filters/entities, full SDK models, framework filtering, complete
downstream applications, controlled live interoperability and every other open
acceptance criterion remain unfinished. PR #2 remains draft and unmerged.
