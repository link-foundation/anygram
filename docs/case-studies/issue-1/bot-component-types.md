# Entity and button subtype declarations

This advances R01/R05/R08/R13/R16/R17/R19 within
[PR #2](https://github.com/link-foundation/anygram/pull/2).
The preceding declarations export general wire-model aliases but omit the public
entity and button namespaces. Applications cannot name callback buttons or text
link entities, even when their values already satisfy the runtime API.

The type-only `Telegram` namespace now exposes seven `MessageEntity`, twelve
`InlineKeyboardButton`, eight `KeyboardButton` and ten `RichMessageButton` names.
Together with the preceding message/chat/update change, this covers all 130
names in the eight model namespaces exported by pinned `@grammyjs/types` 5.0.0.
The new declarations project owned official model fields and share their bases;
they import no SDK implementation or production dependency. General wire aliases
retain their shapes, including string keyboard buttons.

Named entities require their kind-specific payloads. Date-time entities use the
documented format vocabulary, poll buttons retain their quiz/regular choices and
rich login buttons omit `bot_username`. Boolean button flags accept both values,
matching the public SDK contract. Rich labels recursively retain date formats
and required nested button actions. The first assignment comparison exposed ten
rich-label failures; refining these two recursive fields makes all 37 subtype
comparisons pass in both directions, without suppressing mismatches.

Public name and field-presence facts are archived with hashes of their three SDK
sources. The generator also validates every projected field against the owned
official model facts. The independent SDK oracle verifies the complete 37-name
inventory, every required/optional key set and mutual assignment. Portable
examples compile against the owned declarations and actual grammY 1.46.0 /
Telegraf 4.16.3; the Telegraf example uses its older supported vocabulary.

```sh
node experiments/composer-fluency-check.mjs --components --before
node experiments/composer-fluency-check.mjs --components
node node_modules/typescript/bin/tsc --project experiments/tsconfig.bot-filters.json
node experiments/generate-bot-components.mjs --check
node experiments/generate-bot-component-oracle.mjs --check
```

The first command freezes the public declarations at terminal head
`2dbeff7aaa23d56e12bf9bf18e227dafb1c29d81`. The initial portable examples produce
48 diagnostics before implementation. The final examples, including nested-label
assertions, reproduce 61 diagnostics with those frozen declarations. The checked difference fixture explicitly
records the general wire rich-text alias's broader shape while proving both
directions for the named component label.

Local checks pass all 2,022 core tests on each of Node, Bun and Deno, full
ESLint/Prettier/declaration checks and exact regeneration. The duplication gate
scans 155 production sources with zero clones; packaging permits 198 entries.
The production JavaScript is unchanged by this declaration change.

The complete SDK type surface, conditional server constraints, refined chat/update
results, manual helpers, framework integrations and all wider account, protocol
and downstream application criteria remain unfinished. Namespace coverage does
not establish complete SDK or application compatibility.
