# Context user, query, business and configuration comparisons

This change binds 51 grammY 1.46.0 and 27 Telegraf 4.16.3 context helper names to
the existing shared positional APIs. The independently supplied arguments and
ten event shapes live in
[`tests/fixtures/context-services.js`](../../../../tests/fixtures/context-services.js).
Both inventory sizes and every helper's existence on the actual SDK prototype
are asserted. The SDK context fingerprints are recorded in
[the delivery comparison](bot-context-delivery.md).

The grammY inventory covers user photos/audio/emoji status/boosts/gifts,
business connections and account settings, managed-bot access and tokens,
message file selection, chat-join/guest queries, menu/default administrator
settings, story/gift operations, inline and payment replies, prepared messages
and buttons, refunds/subscriptions, verification, business reads, passport errors
and callback answers. The Telegraf inventory covers query replies, boosts,
passport errors, sticker management, commands, menus and administrator defaults.
It preserves that SDK's distinct arguments and assertion hooks.

## Reproduction and root causes

At preceding head `f346e4accfbab58cdb89525b74d141d09d924b93`, these helpers were
absent apart from the callback method, whose missing-context behavior differed.
The initial 80-case comparison failed all 78 behavior cases before implementation.

Override tests then exposed another compatibility defect: grammY contexts pass
omitted optional arguments as explicit undefined values to public API methods.
Spread-only bindings lost those argument positions. Telegraf's menu helpers had
the opposite problem: the owned binding appended an extra undefined request
argument. All three override tests failed before their corrections, including
one covering the preceding administration helpers.

Reproduce the complete 303-case service and administration suite against the
preceding context entry, administration and scope modules:

```sh
node --loader ./experiments/context-services-before-loader.mjs \
  --test tests/bot-context-services.test.js tests/bot-context-admin.test.js
```

The loader pins those three modules to Git with a 64 KiB bound per file, retaining
the actual SDKs and complete current assertions. It reproduces 95 failures and
208 passes. Local evidence is in `ci-logs/context-services-before-complete.log`;
the separate override reproduction is `context-services-overrides-before.log`.

## Implementation and verified behavior

The shared binding selects the required context identifiers, then delegates all
payload conversion to the selected positional API. Business helpers require the
business connection; managed helpers require the managed bot; user and query
helpers retain their own source objects and error labels. Managed-token
replacement retains the pinned SDK's `getManagedBotToken` missing-context label.
Chat-join WebApp replies similarly retain the answer-query label. Story reposts
use the original story's chat and ID. Refunds require the current successful
payment, and business reads require connection, chat and message identifiers.

File lookup selects the last photo before other media and does not fall back
from an empty photo array. The seven other media fields retain SDK precedence.
Custom emoji lookup uses message entities, preserving duplicates and ignoring
caption entities, matching the pinned SDK. Pre-checkout strings become error
messages; callback strings become text. Caller objects and incoming updates stay
unchanged, and zero-valued IDs remain present.

Public API argument widths reuse the already regenerated grammY signature facts.
The same binding now preserves administration override calls without duplicating
an SDK implementation. Context declaration types share prefix-removal machinery
and the regenerated positional argument tuples. A
[checked example](../../../../examples/typed-bot-context-services.ts) exercises
both styles. Complete SDK argument/result models remain open.

The 96 focused service cases pass, as does the new administration override case.
They include every helper's cancellation signal and pre-cancellation without
HTTP, embedded deadlines, actual override calls and eight backend HTTP cases.
Those cases exercise query replies, boosts, business settings/file lookup or
menus/sticker lookup through actual native, grammY, Telegraf and
node-telegram-bot-api backends. All 1,661 core cases pass on Node, Bun and Deno,
as do the 303 focused service/administration cases on Node 20. Strict static
gates, exact generation, 26 native integrations, two vendor wire cases and
the bounded FIFO probe pass. The scan covers 100 production sources with zero
clones; the package contains 143 permitted entries.

Context edits, forwarding, reactions, filters/entities, full SDK models, complete
downstream applications, controlled live interoperability and every other open
issue criterion remain unfinished. PR #2 remains draft and unmerged.
