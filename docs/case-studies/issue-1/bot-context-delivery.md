# Context chat delivery comparisons

This checkpoint implements the 25 chat delivery shortcuts and aliases in pinned
grammY 1.46.0 and the 41 in pinned Telegraf 4.16.3. The owned context layer derives
scope and delegates payload construction to the existing shared positional APIs.
It does not import either optional SDK in production or copy its implementation.

The comparison uses actual public SDK context calls with independently supplied
arguments, then compares their resulting JSON payloads against owned contexts.
The pinned source fingerprints are:

| SDK context               | SHA-256                                                            |
| ------------------------- | ------------------------------------------------------------------ |
| grammY `out/context.js`   | `a3c7624fec5ae27396b1b2136b978f5ef5bdcb86afcf52add6667d7c184ec822` |
| Telegraf `lib/context.js` | `b70ee6035562cf100a8fd9fde38699f85af6fcc313a2db97b077d6217b62ccfb` |

The exact independent argument inventory lives in
[`tests/fixtures/context-delivery.js`](../../../../tests/fixtures/context-delivery.js).
The tests verify every listed name against the actual SDK prototype and fix the
inventory sizes, so a missing oracle method cannot silently skip a comparison.

## Reproduction and cause

At preceding head `0e55209c21a7011d481a31c32f965ce3bc5d5ecf`, `ctx.reply` and
seven media shortcuts passed only `chat.id`, caller data and caller options to
the API. Automatic business, forum and direct-message topic fields were lost;
business-connection updates have `chatId` without `chat`. The other delivery
shortcuts were absent. Missing scope produced incidental property errors rather
than the SDK's context error.

Run the complete regression suite against that preceding context source:

```sh
node --loader ./experiments/context-delivery-before-loader.mjs \
  --test tests/bot-context-delivery.test.js
```

The bounded loader replaces only the owned `src/bot-context.js` module from Git,
leaving the actual SDKs, current assertions and working tree untouched. It
reproduces 154 failing cases and two passing inventory checks. Logs are retained
locally in `ci-logs/context-delivery-before-pinned.log`. The original 134-case
comparison was executed before implementation and failed 132 cases. Two later
regressions caught omitted dice arguments and Telegraf errors without an update
type. A separate actual-alias comparison caught an extra undefined argument
being passed to a user override of `reply`.

## Preserved behavior

| Delivery family                                                                                                                                           | grammY automatic fields                                       |
| --------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Text, rich message, photo/live photo, audio, document, video/animation, voice/video note, paid media/media group, location, venue, contact, dice, sticker | Business connection, topic-only thread, direct-message topic  |
| Poll and game                                                                                                                                             | Business connection and topic-only thread                     |
| Chat action                                                                                                                                               | Business connection and message thread even outside a topic   |
| Invoice                                                                                                                                                   | Topic-only thread and direct-message topic                    |
| Text/rich draft                                                                                                                                           | Current update ID as draft ID and topic-only thread           |
| Checklist                                                                                                                                                 | Required business connection and chat as positional arguments |

Caller options override the automatic fields. Context and argument objects are
not mutated. `sendPaidMedia` delegates dynamically to `replyWithPaidMedia`.
Missing identifiers throw the pinned grammY error before backend dispatch;
identifier checks distinguish undefined from zero or other present values.

Telegraf's 19 `send` methods and corresponding `reply` aliases derive a thread
only from an accessible topic message. They do not automatically add business
or direct-message topic fields, matching the pinned version. Dice accepts an
options object, while invoice accepts an invoice object. Markdown, MarkdownV2
and HTML aliases set the parse mode before caller overrides and delegate to
`reply`. Alias dispatch preserves user overrides. Missing scope preserves
Telegraf's typed error and update-type selection, including the error for an
update without any object event.

Final cancellation signals and embedded `{ signal, timeout }` controls reach the
shared operation boundary and never enter the Telegram payload. The checked
declaration example uses each SDK's different dice and invoice signatures. A
shared context constraint lets scene/wizard and middleware types retain the
concrete SDK context without forcing these incompatible signatures together.

## Verification and limits

The 156 focused tests cover all 66 helper names, topic and ordinary messages,
inaccessible callbacks, business connections, explicit field precedence,
missing-scope errors, signals/deadlines and dynamic aliases. Eight HTTP cases
verify location and media-group requests through the actual selected native,
grammY, Telegraf and node-telegram-bot-api backends. Eight blocked-upload cases
verify deadlines before dispatch, with a separate one-second fixture watchdog
and finite local HTTP peers.

All 1,358 core cases pass on Node, Bun and Deno. The strict duplication gate scans
94 production sources and finds zero clones. Full static, native integration,
focused Node 20 and package validation are recorded in the execution plan.
These cases do not establish the remaining
context edit, query, administration, forum, file, business, story, gift, filter
and entity APIs, complete SDK type models, all downstream applications, live
Telegram interoperability or the other open criteria in
[`requirements.md`](requirements.md). PR #2 stays draft and unmerged.
