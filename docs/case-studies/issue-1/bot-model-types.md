# Bot API field declarations

This checkpoint advances R01/R05/R08/R13/R16/R17/R19 in
[issue #1](https://github.com/link-foundation/anygram/issues/1), within
[PR #2](https://github.com/link-foundation/anygram/pull/2).

The previous declarations expose many message and update fields as `unknown`.
A consumer cannot read a photo identifier, replied document, sender name or
reaction list without casts. There is also no public namespace for the
documented Bot API models.

## Primary facts and independent generation

The [official reference](https://core.telegram.org/bots/api) was retrieved on
2026-10-29. Its complete HTML is archived at
[api-2026-10-29.html](data/bot-api/api-2026-10-29.html), SHA-256
`66a622abe7c8a03f4957236f94019853f91d5c8b755b53a5230859bfbc221d61`.
The separate [facts file](data/bot-api/model-facts.json) contains 400 model
names and 1,888 field facts: names, primitive/reference types, optional flags,
explicit constants/enums, union members and upload capability. It contains no
copied field descriptions. Its reviewed SHA-256 is
`e4b537a1ec37fd75889d1dc7030161604f9456b8ea6eea6a988692cab0d4111f`.

`experiments/extract-bot-model-facts.py` extracts those facts. Eight focused
regressions cover Unicode emoji images, straight/curly quotes, file extensions
inside enumeration descriptions, ordinary payload prose, conditional numeric
values, optional uploads, recursive rich text and plain keyboard strings.
The CI lint job runs these parser regressions, including exact extraction
of the complete archived document.

`experiments/generate-bot-models.mjs` independently generates ten declaration
files under `src/bot-types/`. It verifies both reviewed hashes, rejects unknown
references and unexpected output files, and supports exact `--check` output.
No third-party SDK declarations or implementation are copied into production.
Shared field sets are factored with exact expansion verification, including
cycle and duplicate-field checks. The normal duplication gate remains intact.

The type-only `Telegram` namespace exports all 400 names. `BotMessage` and
`BotUpdate` use the generated wire definitions, and context senders use `User`.
Discriminated unions retain the documented tags. Arrays can nest, rich text
can recurse, keyboard buttons can be strings, and attachable input fields accept
owned `InputFile` values alongside existing identifiers. Empty marker objects
use the structural `object` type, retaining compatibility with SDK marker
interfaces. Their lack of documented fields does not imply a runtime validator.

## Reproduction and comparisons

The checked example `examples/typed-bot-models.ts` reproduces 14 compiler
diagnostics against the preceding declarations from
`baa796927da5cc69ea00040e00c3936c25e4ea60`:

```sh
node experiments/composer-fluency-check.mjs --models --before
node experiments/composer-fluency-check.mjs --models
```

The second command compiles the same fixture against current declarations in
an isolated temporary workspace. Both paths clean up that workspace. Negative
assertions require numeric user identifiers, required wire fields and correct
media subtype properties.

The normal TypeScript project also checks all 399 non-upload model names
against the pinned `@grammyjs/types` 5.0.0, using `string` for generic uploaded
files. The owned `InputFile` is intentionally a separate runtime object.
There are **382 direct assignment matches and 17 explicit differences**:

| Root difference            | Official wire table | Pinned SDK declaration | Affected comparisons                            |
| -------------------------- | ------------------- | ---------------------- | ----------------------------------------------- |
| `Message.is_topic_message` | Optional `True`     | Optional `boolean`     | Message and 14 models recursively containing it |
| `WebhookInfo.url`          | Required `String`   | Optional `string`      | WebhookInfo                                     |
| `RefundedPayment.currency` | Always `XTR`        | `string`               | RefundedPayment                                 |

The oracle asserts these exact outcomes and the six root property types. It
does not silently skip failed models. A new difference or a changed expectation
fails compilation. For expanded diagnostics, generate direct assignments with
`node experiments/generate-bot-model-oracle.mjs --diagnostics`; its generated
diagnostic fixture intentionally reports the documented differences.

Three portable runtime tests preserve the primary-document hash, complete
inventory and subtle field facts. `npm run typecheck` compiles all checked
examples and the actual SDK comparison, then checks exact regeneration.

## Remaining acceptance criteria

These are declarations of the official field tables. SDK-specific refined
message/chat unions, complete filter narrowing, per-method argument/result
models, plugin integration, webhook fast responses and the wider account,
application and live-interoperability requirements remain unfinished. Counts
of models and passing checks do not establish complete ecosystem compatibility.
