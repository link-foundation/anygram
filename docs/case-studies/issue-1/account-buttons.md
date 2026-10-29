# Account buttons and poll interactions

[PR #2](https://github.com/link-foundation/anygram/pull/2) adds `buttons`,
`buttonCount`, `getButtons` and `click` to the client-bound account message views.
Previously, fetching a message with a keyboard and calling `message.click({i:0})`
threw because the detached view had no interaction methods. Both styles now use
one owned implementation with their existing selected client and source peer.
This advances R01/R02/R05/R17/R19; full issue completion remains open.

The actual pinned GramJS and teleproto models provide the comparison contracts.
GramJS uses individual callback/URL/game/switch button constructors; teleproto
uses typed inline and ordinary keyboard buttons. Both layouts retain text,
callback data, URL, inline query and raw button metadata. Cached rows keep their
identity and share the detached message markup. Client and peer ownership live
in WeakMaps, outside enumerable or serialized data. Async button lookup can
reload one source message when a switch-inline bot hash is missing. Source chat
resolution retains the existing one-page, 100-dialog bound.

The seven interaction families are callback, game, URL, switch-inline, ordinary
text, explicit contact and explicit location. Flat index, row/column, text and
predicate selectors choose a button; direct callback bytes also work without
markup. URLs return their string. Text sends through the same origin-bound
message helper. Switch-inline requests use shared schema resolution to convert
the appropriate sender/via-bot InputPeer into InputUser. Callback/game requests
return null only for BOT_RESPONSE_TIMEOUT and preserve other typed errors.
Phone and location buttons require explicit sharePhone/shareGeo input. Contact
objects avoid an account lookup; true or a phone string uses getMe for names.
Coordinates accept a longitude/latitude pair, InputGeoPoint or InputMediaGeoPoint.

Password callbacks fetch account password parameters and reuse the existing SRP
proof implementation. Signals are checked before the fetch, before expensive
derivation and before callback submission. Four independent server-arithmetic
proof checks cover actual SDKs and owned callbacks. A cancellation regression
uses invalid parameters to prove that a cancelled fetch never starts derivation.
Direct callback bytes are copied before asynchronous origin lookup.

Poll selection accepts one index, multiple indices, exact text, a text predicate
or an answer predicate. Empty selection retracts a vote, including absent or
unmatched selectors, matching the SDK helpers. Both actual SDKs contain a
multi-index defect: i:[2,0] sends the first two options. Owned selection sends
the requested third and first option bytes in that order. Closed polls, invalid
or duplicate indices and multiple answers on a single-choice poll fail locally.
Subscriber/country eligibility and other account permissions still rely on
preserved Telegram RPC failures; complete client-side eligibility is unfinished.

The finite suite contains 76 new cases. All fail against immutable preceding
account-message source and pass with this implementation. Sixteen comparisons
check complete actual callback/vote request bytes. Two more resolve actual SDK
start-bot requests and compare complete bytes after normalizing their random IDs.
The suite also checks explicit contact/location media against actual teleproto,
five selected adapters, encrypted local TCP, cancellation, detached data and
bounded missing-bot reloads. Pinned GramJS phone clicks remain unsupported and
its location branch checks an unrelated constructor; those differences are
recorded instead of copied. The checked example has twelve frozen declaration
diagnostics and four negative argument checks, while a portable fixture compiles
against both actual SDKs and the owned types.

```sh
node --loader ./experiments/account-buttons-before-loader.mjs --test tests/account-buttons.test.js tests/account-button-boundaries.test.js tests/account-button-password.test.js
node --test tests/account-buttons.test.js tests/account-button-boundaries.test.js tests/account-button-password.test.js
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --account-buttons --before
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --account-buttons
node experiments/record-account-button-facts.mjs
```

The frozen revision is 5c4de84dd8440c39e36e8954d5ab0630a9360148. Runtime reproduction
freezes account-message.js; declaration reproduction also freezes the public
index and account message declarations. The [fact inventory](data/account-buttons.json)
records exact SDK source hashes and official request contracts:
[callback answers](https://core.telegram.org/method/messages.getBotCallbackAnswer),
[poll votes](https://core.telegram.org/method/messages.sendVote) and
[starting bots](https://core.telegram.org/method/messages.startBot).

UI-only button families without an action in the pinned custom models retain
their metadata and return undefined from click. Web-app/auth/payment workflows,
complete SDK model/formatting parity and controlled production Telegram account
interoperability remain unfinished. Passing local comparisons establishes the
tested requests and boundaries, not those wider criteria.
