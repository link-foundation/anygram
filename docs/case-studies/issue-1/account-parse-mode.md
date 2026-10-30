# Account parser callbacks and text views

This checkpoint advances R01/R02/R05/R17/R19 with shared custom parse modes for
canonical MTProto send/edit calls, both account facades and bound message helpers.
It does not complete the ordinary-markup or complete SDK compatibility criteria.

## Reproduction and implementation

Before this change, `setParseMode` and its shared setting were absent. Per-call
parser objects reached request normalization without being called, and message
`text` always returned raw text. The immutable runner freezes the preceding
source at `2e0eecc164df94c0af5a2c0109fba83e927916fb` while keeping the same SDKs,
tests and independent assertions. Run the reproduction with:

```sh
node --import 'data:text/javascript,import { register } from "node:module"; import { pathToFileURL } from "node:url"; register("./experiments/account-parse-mode-before-loader.mjs", pathToFileURL("./"));' --test tests/account-parse-mode*.test.js
node experiments/composer-fluency-check.mjs --account-parse-mode --before
```

The setting is shared by a client and its two account facades; `withBackend`
copies the current parser reference into an independently configurable scope.
The disconnected factory accepts the same setting. Callbacks run synchronously
with their original receiver, before normalization, and never become TL fields.
The existing default remains plain text until configured. Bot API calls retain
their own `parse_mode` setting.

Explicit `formattingEntities`, canonical `entities` (including empty arrays),
and `FormattedText` preserve supplied formatting. Per-call `false` disables
parsing. Parsed send/edit requests use the same selected raw transport, and
bound replies/edits retain their source peer and access hash. A formatted facade
send uses the facade's loaded peer cache, matching bound-message resolution.
Parser mentions resolve exact decimal/bigint user IDs, usernames and phones;
self and message-context input users retain their distinct constructors.

Message `text` reads call `unparse` with detached camelCase entity views. Writes
validate the complete parse result before replacing message text/entities.
Malformed pairs, non-entity constructors, invalid UTF-16 spans, more than 1,000
parser entities, and text longer than 4 Mi code units are rejected. Existing TL
depth/vector bounds also apply. Cancellation is checked before parsing and
after mention resolution; a failed lookup never triggers a send or replay.

## Verification

The 72 focused cases cover settings, explicit overrides, receiver state,
detached getters, atomic setters, finite input/output limits, typed lookup
failures, all five selected adapters and a four-request independently encrypted
native TCP scenario. The frozen source fails 66 cases. The two high-level-only
sends and Bot API separation already pass there; three direct helper guards use
current helper code. Those six are not missing-API reproductions. Review also
preserves high-level-only backend support and the original plain send options.
Frozen declarations produce nine diagnostics. The checked
[migration example](../../../examples/typed-account-parse-mode.ts) and
[actual-SDK fixture](../../../experiments/typed-account-parse-mode-sdk-fixture.ts)
compile after the change.

Twelve send/edit comparisons execute actual installed SDK helpers. Full requests
serialized through each SDK match its helper output. For teleproto, the owned
current codec also matches every byte. Pinned GramJS uses older method IDs;
its following argument bytes match exactly, while the differing four-byte
constructor IDs are asserted explicitly. Four message-view comparisons use
actual SDK parsers and unparse/getter behavior. Source versions, hashes and
official formatting references are preserved in
[the facts inventory](data/account-parse-mode.json).

## Intentional differences and remaining work

Pinned GramJS patches the `text`/`rawText` getter and loses its setter. The test
asserts that defect and invokes the actual `CustomMessage` setter separately
when comparing parsed state. Owned setters work. Owned getters also recompute
from current settings/data instead of retaining the SDK's stale `_text` cache.
Failed setters leave prior text/entities intact.

The SDK TextUrl mention helper converts decimal IDs to `Number` and catches
lookup failures. Owned conversion keeps exact IDs and propagates the selected
typed failure, preserving links and avoiding silent send retries.

Custom unparse callbacks receive owned entity views. An SDK callback that checks
nominal classes, notably pinned GramJS HTML `unparse`, needs an adapted callback;
passing its static parser does not establish complete output interoperability.
The declaration retains checked parse output and a string unparse result, while
allowing an SDK's nominal entity argument declaration at that callback boundary.

Independent [builtin HTML conversion](account-html.md) and
[Markdown/MarkdownV2 string modes](account-markdown.md) are now implemented.
The SDK default Markdown choice, file/album parsing, full rich/model declarations, older-schema
bridging, production account scenarios and all wider acceptance criteria remain
open. Bound edits correctly take `text`; `message` is the reserved ID argument.
