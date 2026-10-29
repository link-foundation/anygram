# Message subtype names and method results

This checkpoint advances R01/R05/R08/R13/R16/R17/R19 in
[issue #1](https://github.com/link-foundation/anygram/issues/1), within
[PR #2](https://github.com/link-foundation/anygram/pull/2).

Delivery results previously exposed only the general optional-field `Message`
model. Consequently, replies, raw calls and positional methods lost documented
required fields, edits lost their edit timestamp and album elements could not
be distinguished by their content fields. Public SDK subtype names were absent.

## Owned declarations and actual SDK comparisons

The type-only `Telegram` namespace now exposes all 81 message subtype names from
pinned `@grammyjs/types` 5.0.0, alongside eight named chat variants and the four
update refinement names. Message subtypes project the independently generated
official model fields. Public name/presence facts retain a source hash; production
declarations import no SDK. Bases share their projections to avoid duplication.
The ordinary general wire models retain their existing precision and shape.

Twenty-nine message result contracts now retain their content through raw calls,
positional methods and scoped replies/actions. Animation results include their
backward-compatible document; venue results include location. Album result unions
support content-field discrimination. Text, location, caption, media, markup and
game edits retain the documented edit timestamp and inline `true` alternative.
Telegraf string/formatted-text edits keep their text-only result, while grammY
keeps its text/rich-message union. Canonical native file sends retain their
actual document result.

The two portable examples compile against both current declarations and actual
grammY 1.46.0 / Telegraf 4.16.3 with strict library checking. A separate generated
oracle checks the complete modern message namespace inventory and every subtype's
required/optional field set against the actual SDK declarations. Underlying field
types remain covered by the existing 399-model comparison, including its explicit
wire/SDK precision differences; field-presence comparisons do not claim those
differences disappeared.

```sh
node experiments/composer-fluency-check.mjs --message-subtypes --before
node experiments/composer-fluency-check.mjs --message-subtypes
node node_modules/typescript/bin/tsc --project experiments/tsconfig.bot-filters.json
node experiments/generate-bot-subtypes.mjs --check
node experiments/generate-bot-subtype-oracle.mjs --check
```

The first command freezes preceding public declarations at
`cb9f92cfdb401628e1a2f6aef392a1696427c61a`; the second compiles against the current
declarations. Both remove their temporary trees. Runtime production code is
unchanged by this checkpoint.

The frozen declarations produce 27 diagnostics, including missing names and
lost audio, edit and album fields. Current portable examples and the complete
81-subtype SDK oracle compile successfully. All 2,007 core tests pass on each
of Node, Bun and Deno. The local static gate passes, scans 154 production
sources with zero duplicate clones, and packaging permits 197 entries.

Initial CI at `5d3232a5b8cbe393f81d268bd9acecd2100bd4bb` passed its runtime
matrix but failed declaration generation because the two checked source examples
were omitted from that commit. Preserved run 40925315092 reports the missing
`examples/typed-grammy-message-subtypes.ts` at log line 1800. The follow-up commit
includes both already-verified examples; this was a commit inventory defect.

## Remaining acceptance criteria

Other SDK namespaces and conditional server constraints, full chat/update result
refinement, remaining manual helpers, framework/webhook integration,
vendor-private input conversion and the wider account/application/protocol and
production interoperability criteria remain unfinished. Subtype name and
field-presence inventories do not establish complete SDK compatibility.
