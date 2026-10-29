# Context update data and source selection

The pinned grammY 1.46.0 context exposes 27 direct update aliases; Telegraf
4.16.3 exposes 18. Previously the shared context exposed only eight. Business
messages, edited channel posts, reactions, boosts and membership updates could
therefore reach a handler without the expected message, chat or actor. The
aggregate message, inline and sender selection also differed from both SDKs.

The complete reference context sources have SHA-256:

- grammY: `a3c7624fec5ae27396b1b2136b978f5ef5bdcb86afcf52add6667d7c184ec822`
- Telegraf: `b70ee6035562cf100a8fd9fde38699f85af6fcc313a2db97b077d6217b62ccfb`

One owned resolver now installs the update aliases and aggregate getters from
public field/source-order facts. It keeps SDK-specific precedence, including
callback versus edited-channel messages, whole-object versus individual-field
fallback, reaction actor fields, business connections and inline identifiers.
Telegraf's detached message view supports `has` and `isAccessible` without
changing the incoming message or its prototype. The union also makes the newer
update aliases available on the Telegraf view.

Declarations share one mapped alias type and retain concrete message/reaction,
chat, business connection and identifier fields. The checked
`examples/typed-bot-context-data.ts` demonstrates these handlers. Complete SDK
object models, filtering and scoped method parity remain separate open work.

## Reproduction and verification

Run the preceding source against the unchanged SDK comparisons and assertions:

```sh
node --loader ./experiments/context-data-before-loader.mjs --test tests/bot-context-data.test.js
```

The loader substitutes only the owned context source from commit
`5b6b1a8bb1b4d284b97efcbc75a38c6d6bf0dee8`, bounds its Git output to 64 KiB and
does not change working files. It reproduces **53 failures and nine passes** in
`ci-logs/context-data-before-pinned.log`. An earlier draft had an incorrect
Telegraf inventory count; the pinned reproduction uses the corrected exact
27/18 counts and still reproduces all 53 failures.

Run the current implementation with:

```sh
node --test tests/bot-context-data.test.js
```

All 62 cases pass. They inventory every actual direct alias, compare every
supported update shape and six aggregate fields, test source precedence and zero
IDs, and compare the two message helper methods. Four bounded local HTTP cases
construct the actual native, grammY, Telegraf and node-telegram-bot-api backends.
They send a business message with its explicit connection identifier and route
both context styles' reaction chat/message IDs into real Bot API requests.
These cases use no Telegram credentials or production account.

All 1,202 core tests pass on Node, Bun and Deno; the 62 focused cases also pass
on Node 20.18.3. Strict lint, formatting, complete declaration/example compilation
and exact method/schema generation pass. The duplication gate scans 92 production
sources and reports zero clones. The package dry run contains 135 permitted
source/package/README/LICENSE entries and excludes SDK dependencies and research.

This advances R01/R05/R08/R13/R16/R17/R19. It does not complete the feature union,
all context shortcuts, downstream applications or controlled-account evidence.
