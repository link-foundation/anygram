# SDK middleware scopes and Telegraf composition

The shared composer previously returned itself from `use`, `on`, `hears` and
`command`, and recognized only two filter segments. As a result,
`composer.on('message:text').use(handler)` registered `handler` globally.
Commands considered only ordinary message text. Most routing, reaction,
concurrency, boundary and Telegraf static middleware helpers were absent.
Telegraf inherited grammY's scoped `filter` despite its own global filtering
contract. These were registration/dispatch defects, independent of transport.

`tests/composer-scopes.test.js` and `tests/telegraf-composer.test.js` compare the
independent implementation with actual installed grammY 1.46.0 and Telegraf
4.16.3. The initial 42 grammY cases reproduced 35 failures; the initial 57
Telegraf cases all failed. The immutable loader freezes the preceding public
entry and composer consumers at `8835d73871b4ebd1076b653b5286755890f67bb8`.
It keeps the real SDKs and every current assertion intact:

```sh
node --experimental-loader ./experiments/composer-before-loader.mjs \
  --test tests/composer-scopes.test.js tests/telegraf-composer.test.js
node --test tests/composer-scopes.test.js tests/telegraf-composer.test.js
```

## Registration and execution

The default `Composer` now returns distinct, independently extensible grammY
scopes. Middleware objects resolve at execution time, so later child
registrations remain visible, while a previously obtained parent middleware
keeps its registration snapshot. Empty and singleton composers retain direct
continuation results and function identity. Filters reuse `Context.has`,
including the complete public filter grammar, caption/channel sources and
matching state. Every pinned grammY Composer prototype member has inventory
coverage.

Async filter/drop, lazy function/array/composer factories, route fallbacks,
branches and fork ordering are compared directly. Fork completion joins both
paths; its continuation cannot enter the main path. Error boundaries await
protected work before continuing outside, wrap the original error/context and
do not catch subsequent outside errors. Late protected registrations and
predicate failures are included. The exported `BotError` retains pinned names,
messages, thrown values and original error stacks; the existing bot catcher also
keeps Anygram's `cause` alias. `run` is a convenience export compared with the
pinned SDK's internal composer runner.
Symbol errors use explicit string conversion, preserving Anygram's existing
catcher behavior rather than inheriting the pinned SDK's formatting exception.

`TelegrafComposer` preserves fluent registrations, global filter/drop,
raw-update guards and legacy message-field selectors. Its static factories cover
composition, context replacement, lazy routing, optional branches, access/status
guards, chat types, entity text, logging, reply, tap/fork and catch. `Telegraf`
installs the same instance/static surface over the shared bot runner; scenes
inherit it directly. The bot dispatch path supplies the final continuation,
which an integration regression showed was required when every Telegraf handler
calls `next`.

Telegraf commands retain exact first-entity, username, regex/function trigger,
payload and lazy argument behavior. Argument comparisons cover quotes, escapes,
newlines, tabs, unfinished quotes and whole text-link/mention entities. Parsed
arguments cache and remain assignable. Entity type registration snapshots and
captured command entity lists survive caller mutation. Added/removed reactions,
empty trigger errors, regex resets, singleton synchronous catch behavior and
invalid composition/context errors have actual SDK comparisons.

Existing Anygram `action` and scoped callback/result/payment-query extensions
remain available. Telegraf's own `gameQuery` accepts middleware directly and its
`inlineQuery` follows Telegraf trigger semantics. Checked declarations and
`examples/typed-composers.ts` exercise both registration styles, factories and
context replacement. The existing repeated-next regression now includes a
downstream middleware and expects grammY's exact error: the pinned SDK returns
singleton middleware unchanged and therefore guards composed continuations.

The implementation has no production dependency on either SDK. Source inspection
informs behavioral comparisons; owned dispatch and parsing are separate code.
Trigger registrations retain the existing finite 1,000-entry safeguards.

## Verification and remaining criteria

The final 118-case suite reproduces 111 failures and seven passes against the
frozen preceding modules; all 118 cases now pass, including on Node 20. All
2,002 tests pass independently on Node, Bun and Deno. Strict lint, formatting,
declaration/example compilation and exact fact regeneration pass. The
duplication gate scans 116 production sources with zero clones; packaging
contains 159 permitted entries. All 26 native terminal checks, two actual
Telegraf wire cases on Node 20 and the bounded FIFO cleanup probe pass. Main
remains an ancestor. The atomic diff and paginated PR file inventory were
reviewed; GitHub rejects the complete PR diff above 300 files. Full SDK filter
type narrowing, exhaustive public models and subclass fluent type precision
remain open. Runtime method inventory and these oracle
cases do not prove complete ecosystem parity or the issue's broader protocol,
downstream, browser, platform and controlled-account requirements. Those remain
open in PR #2.
