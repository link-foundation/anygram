# Delivery, edit and upload argument declarations

This checkpoint advances R01/R05/R08/R13/R16/R17/R19 in
[issue #1](https://github.com/link-foundation/anygram/issues/1), within
[PR #2](https://github.com/link-foundation/anygram/pull/2).

Manually installed media helpers and scoped delivery previously accepted
`unknown` files, media groups, poll options and invoice prices. Reply/edit option
records also accepted invalid documented fields. Conversely, the official raw
request declarations rejected valid byte arrays, Blobs and legacy source wrappers
that the shared runtime upload reader already supports.

## Shared argument contracts

Context delivery now derives its arguments from the existing positional method
tuples, removing duplicated untyped argument lists. Draft and checklist methods
remove their two context-supplied identifiers; ordinary methods remove the chat
identifier. Telegraf retains its distinct invoice, dice and quiz signatures, and
owned grammY dice calls retain the existing omitted-emoji extension.

Manually installed media methods specialize the official file/option contract
per media kind. Replies and text edits check documented nested options. Telegraf
text edits retain string/formatted-text input, while grammY keeps its rich-message
extension. Native canonical file delivery, edits, deletion and forwarding also
retain their typed sources and identifiers.

`BotFileInput` describes the representations recognized by `collectUploads`:
owned `InputFile`, byte arrays, Blobs, source wrappers and binary data wrappers.
A request-only recursive mapping preserves those uploads inside albums and poll
media. Top-level captions retain formatted-text normalization. Response models
are unchanged; this mapping does not promise nested caption normalization or
portable conversion of arbitrary vendor-private file objects.

## Reproduction and actual SDK comparison

```sh
node experiments/composer-fluency-check.mjs --delivery-arguments --before
node experiments/composer-fluency-check.mjs --delivery-arguments
node node_modules/typescript/bin/tsc --project experiments/tsconfig.bot-filters.json
```

The first command freezes the preceding declarations at
`606e831242547be69e36929ee9f35af1a25987fa`. The three final fixtures reproduce
32 diagnostics: five rejected valid upload calls and 27 unused negative
assertions showing accepted invalid inputs. The second compiles all three
fixtures against the current declarations. Both remove their temporary trees.

Generated copies of the two portable delivery/edit fixtures compile against
actual grammY 1.46.0 and Telegraf 4.16.3 with strict library checking and pinned
ambient dependencies in CI. Owned upload extensions have their separate checked
example. The existing runtime upload, delivery and message-action suites retain
their selected-backend, immutability and cancellation coverage; runtime production
code is unchanged by this declaration checkpoint.

All 2,007 core tests pass on each of Node, Bun and Deno.
Strict ESLint, formatting, declaration/example compilation, generator checks and
the duplication gate pass; the latter scans 152 production sources with zero
clones. The package dry run contains 195 permitted entries. The atomic declaration
diff and the paginated PR file inventory were inspected after GitHub rejected
the full diff at its 300-file limit. Main remains an ancestor and all four
feedback streams remain empty.

## Remaining acceptance criteria

SDK subtype names, fully refined results and conditional server constraints,
remaining manually described helpers, vendor-private input conversion,
framework/webhook integrations and the wider account/application/protocol and
production interoperability criteria remain unfinished.
