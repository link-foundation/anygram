# Bot API request and result declarations

This checkpoint advances R01/R05/R08/R13/R16/R17/R19 in
[issue #1](https://github.com/link-foundation/anygram/issues/1), within
[PR #2](https://github.com/link-foundation/anygram/pull/2).

Previously, positional methods such as `getChat` returned `unknown`, and raw
methods accepted missing or incorrectly typed fields. Generic dispatcher
results could also acquire a false model from their assignment context.

## Primary contracts and generation

The [archived official reference](data/bot-api/api-2026-10-29.html), retrieved
2026-10-29, has SHA-256
`66a622abe7c8a03f4957236f94019853f91d5c8b755b53a5230859bfbc221d61`.
The separate [method facts](data/bot-api/method-facts.json) record all 185
documented methods, 932 request fields and their result contracts. Their reviewed
SHA-256 is `d5959672c6dda9b316f9cf2d6e7993f6080f48b40e8f189f93264bcea316c6ad`.
The facts contain names, types, required markers, explicit enums and upload
capability, without copied descriptions. All extracted return contracts were
reviewed against their primary introductory text.

`experiments/extract-bot-method-facts.py` reuses the model HTML parser with
lower-case method headings. Eight parser regressions cover required fields,
enums, arrays, conditional message/true results, unrelated model mentions,
unknown contracts and uploads, including exact complete-document extraction.
Both model and method parser suites run in CI.

`experiments/generate-bot-method-types.mjs` checks the reviewed hashes and emits
ten independently owned declaration files under `src/bot-method-types/`.
Shared wire-type conversion rejects unknown model references. Shared request
fields retain exact expansion checks; identical model properties reuse `Pick`
references, and repeated complex fields and wrapper aliases share declarations.
The normal duplication gate remains unchanged.

`BotApiMethod`, `BotApiParams<M>` and `BotApiResult<M>` expose the contracts.
Known raw methods check required request fields and infer their wire result.
`callApi` infers results from its method literal without allowing contextual
assignment to invent a result type. Existing explicit generic calls and unknown
method names retain their extension behavior. Raw calls keep separate request
controls. Request arrays accept readonly values, upload fields accept owned
`InputFile` values, and chat identifiers retain the existing bigint extension.

All 198 grammY wrapper signatures and 125 Telegraf public members use their
existing reviewed argument-source inventories. Positional fields, option
objects, camel-case input objects, nested copy sources and canonical aliases
refer to the independent method contracts. Conditional inline wrappers retain
their true result. Telegraf extra options retain their existing optional and
extension semantics; they check known fields without enforcing every conditional
server requirement. Scoped context arguments reuse these tuples, including
optional prefixes. Complete context result refinement remains open.

The stricter checks also corrected existing examples: an ephemeral identifier
must be numeric, rich messages use `blocks`, sticker upload uses `InputFile` and
a separate format argument, and invoice input requires a description.

## Reproduction and actual SDK comparison

Three checked examples cover portable grammY and Telegraf requests/results plus
owned upload, formatting, exact-ID, extension and inference behavior:

```sh
node experiments/composer-fluency-check.mjs --methods --before
node experiments/composer-fluency-check.mjs --methods
node node_modules/typescript/bin/tsc --project experiments/tsconfig.bot-filters.json
python3 experiments/test-bot-method-facts.py
```

The first command freezes the preceding public declarations at
`565d6fe616a23862ae742705d1169d4392b02029` and produces 38 diagnostics, all in the
three fixtures. The second compiles the same fixtures against current
declarations. Both clean up their temporary declaration trees. The SDK oracle
generates equivalent portable fixtures for actual grammY 1.46.0 and Telegraf
4.16.3, using strict library checking and pinned ambient dependencies in CI.
Telegraf's older `ChatFromGetChat` name is substituted explicitly.

The pinned Telegraf caption-edit result is not assignable to its own complete
`Message` union. The shared fixture therefore verifies its common message ID
and chat fields, or true. Owned declarations retain the official `Message |
true` contract. This is a limited comparison, not full refined-result parity.

All 2,007 core tests pass on each of Node, Bun and Deno. The eight method and
eight model parser regressions pass. Strict static checks and exact generation
pass; the unchanged duplication gate scans 151 production sources with zero
clones. Packaging permits 194 source/package/README/LICENSE entries, including
all ten method declaration files. Runtime production code is unchanged in this
declaration checkpoint.

## Remaining acceptance criteria

Official wire contracts do not establish SDK-specific refined message/chat
models or every conditional request constraint. Manual media and edit helpers,
complete context results, framework integrations, webhook fast responses and
the wider account/application/production-interoperability criteria remain
unfinished. Raw method inventories and passing compilation do not complete
these requirements.
