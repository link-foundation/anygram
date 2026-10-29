# Community posting application migration

The complete six-file source of `konard/telegram-community-posts` is archived
at commit `29e3fe630d3703aedded040ef4bdd554dc0f0be9`. The source manifest records
every byte count and SHA-256 digest. `experiments/collect-community-source.mjs`
repeats the authenticated capture. The 3898-byte application matches the prior
immutable snapshot exactly. Its package uses node-telegram-bot-api `^0.66.0`
and has no working test suite.

## Reproduced defects

The first four regressions executed the original application before the
migration existed. All failed: another user consumed both global one-shot
message listeners; daily limits reset on every callback; callback queries were
never acknowledged; lifting deleted the old message before accepting input or
publishing a replacement. The executable original remains in the test harness,
with its source digest checked before execution.

The original calls `searchPublicChatMessages` on a Bot API client. That method
does not exist in the Bot API. The original-only fixture supplies a search
response to isolate the unsafe deletion order; this does not establish that
the original search works. The migration uses an independently authorized
account's `messages.search` through the selected account backend.

Further failing-before cases exposed definite rejection recovery, username
changes, permanent journal exhaustion, duplicate initialization, timestamp
units, inherited action names, malformed state and shutdown of noncooperating
requests. Each corresponding regression passes after implementation.

## Running the application

From this repository after `npm ci`, retain the original plaintext `token`
file and configure the public channel. The bot needs channel administrator
permission to post and delete its messages. Separately supply account API
credentials in `.env` using `TELEGRAM_USER_BOT_API_ID` and
`TELEGRAM_USER_BOT_API_HASH`. `TELEGRAM_USER_BOT_PHONE` is optional for initial
login. The account must be able to read the channel. A bot token cannot grant
account search access.

```sh
node examples/community-posts-cli.mjs --help
node examples/community-posts-cli.mjs --channel community_posts
node examples/community-posts-cli.mjs --bot-backend grammy --account-backend gramjs
node examples/community-posts-cli.mjs --bot-backend telegraf --account-backend teleproto
```

The bot backend accepts `native`, `grammy`, `telegraf` and
`node-telegram-bot-api`; the account backend accepts `native`, `gramjs` and
`teleproto`. Selection is explicit. Failed requests do not switch backends.
The shared account setup retains bounded environment parsing, lazy terminal
login prompts and portable session persistence. Initial login needs a terminal;
subsequent unattended runs need a saved authorized session. Credentials stay
out of command arguments and default diagnostic output.

Options `--token-file`, `--env-file`, `--session-file` and `--state-file`
change the local paths. The defaults are `token`, `.env`,
`.community-account.session` and `.community-posts.json`. The token read stops
at 1 KiB. The account session is limited to 8 KiB and the application journal
to 4 MiB. Atomic file replacement preserves prior state on failure; private
files use mode 0600 where supported. Default credential/state paths and their
temporary files are ignored by git. Run one process per token and journal;
there is no distributed lock or cross-process transaction protocol.

The Russian `/start` menu and two callback actions remain. Each callback is
acknowledged. Prompts belong to a specific user ID and chat ID, expire after
ten minutes, and survive restart. `/cancel` removes an unsubmitted prompt;
`/status` reconciles an uncertain publication or resumes pending deletion.
Empty, nontext, command and oversized inputs retain the prompt. The username
footer counts toward the 4096 UTF-16-unit text bound.

## Durable side effects and bounds

Post and lift limits persist independently for 24 hours. The journal holds at
most 10000 users. At capacity, expired inactive history and expired prompts
can retire atomically with a new entry; active limits and unresolved delivery
or cleanup intents never retire. If no entry can retire, the operation fails
before sending. Historical ownership metadata can be retired with expired
history. A known owner's most recent post ID and original username otherwise
survive username changes, so lifting looks up that exact recorded message.

The journal persists a publication intent before sending. A successful send
persists the returned message ID and limits. Lifting publishes first, records
a cleanup intent, then deletes the original. Failed replacement delivery leaves
the original intact. Failed deletion resumes from the journal without another
publication. An already missing original completes cleanup.

A definite Bot API 4xx rejection restores the input prompt without consuming
the daily limit. Transport errors and lost acknowledgements retain the intent
and never automatically replay a publication. `/status` searches by exact
body, exact username footer and a publication timestamp, excluding the old
message. Dates from native numeric seconds and vendor Date objects use the
same units. The search walks at most ten pages of 100 results, guards offset
progress and has one overall deadline.

Search-based reconciliation is best effort: Telegram search indexing can lag,
and matching text and timestamps are not an idempotency key. An unresolved
delivery stays unresolved until a matching result appears; the application
does not claim exactly-once publication. Missing indexed history, messages
outside the bounded search window, deleted posts, changed permissions and
retired username history require operational attention. Existing posts made
before migration use the exact username footer as the ownership assumption.

Each application bot/search request has a 30-second deadline and cancellation.
Application listeners serialize mutations; closing aborts active requests,
drains the handler queue and removes only owned listeners. Duplicate
initialization is rejected. The executable owns the account connection until
polling, handlers and journal writes finish. SIGINT/SIGTERM stop polling and
cancel pending work before account cleanup. Per-update errors retain durable
state, advance polling and emit only a generic message plus numeric API code.

## Verification and remaining evidence

Run `node --test tests/community*.test.js` (also Bun/Deno). The cases include
original execution, concurrent users/chats, exact menu/permission behavior,
day boundaries, actual file-store restarts, prompt validation, finite search,
username changes, journal exhaustion, definite/ambiguous failures, a crash
after publication but before final persistence, missing-original cleanup and
bounded cancellation. CLI tests verify help/argument validation precedes
credentials, explicit selections, connection ownership, polling cancellation,
redacted errors and finite token reads.

Two scenarios construct and serialize actual pinned GramJS/teleproto search
requests and results. Four more combine each actual selected bot SDK's local
HTTP requests with an encrypted native MTProto TCP account search. The HTTP
oracle limits count, bytes, decompression, socket time and request time; the
encrypted peer limits RPC count, packets, queued bytes and per-request time.
These are independent local protocol peers, without Telegram credentials.

All 724 core cases pass on Node, Bun and Deno. The 39 community cases also pass
Node 20.18.3. Strict lint, formatting, full declaration/example checks and exact
schema regeneration pass, with zero clones across 84 production sources. The
package contains 127 permitted entries. Thirteen isolated native terminal
integrations, two actual Telegraf Node 20 wire cases and the bounded FIFO probe
also pass. Fresh CI is required after this checkpoint is pushed.

Controlled Telegram account/channel execution, real permissions and indexing
latency remain unverified. This application migration is substantive R14
evidence; it does not complete the issue's full account/framework feature union,
other downstream migrations or production interoperability acceptance criteria.
