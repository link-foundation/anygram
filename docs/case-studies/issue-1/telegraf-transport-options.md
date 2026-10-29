# Telegraf roots and scoped Telegram settings

This advances R01/R05/R08/R13/R16/R17/R19 in
[PR #2](https://github.com/link-foundation/anygram/pull/2). The preceding runner
ignored the SDK's nested `telegram` construction options. Its update contexts
also shared the global Telegram facade instead of owning their mutable settings.

```js
const bot = new Telegraf(token, {
  telegram: {
    apiRoot: 'http://localhost:8081/prefix/',
    apiMode: 'bot',
    testEnv: true,
    webhookReply: false,
  },
});
bot.use(async (ctx) => {
  ctx.telegram.options.webhookReply = true;
  await ctx.telegram.sendMessage(7, 'Hello');
});
```

The global Telegram facade and every update expose immutable `token` and
`options` properties. The settings object itself remains mutable. Each update
gets a shallow copy of the latest global settings, including when no webhook
response is supplied. Context changes affect its calls, canonical file links
and webhook policy without changing later updates or global calls. Credential
metadata remains nonenumerable in the owned implementation.

Native requests and file links retain the SDK's relative URL resolution:
`http://host/prefix/end` resolves calls under `/prefix/`, while a trailing slash
retains `/prefix/end/`. `apiMode` selects `bot` or `user`, and `testEnv` adds the
`/test` segment. Omitted and explicitly undefined settings retain SDK defaults.
The existing top-level owned `baseUrl` extension keeps its prefix-append
semantics, including relative bases understood by a custom fetch hook. Native
mode and environment settings reject invalid runtime values before fetching,
including after context mutation.

A selected direct or unified backend remains authoritative for requests and
file links. Nested native roots do not silently replace that backend. Native
polling ownership uses the normalized endpoint, including mode and environment,
and is shared across Bot, Telegraf and TelegramBot styles. Distinct local roots
can poll independently; equivalent relative roots conflict. Global settings
changed before launch participate in this ownership check. Non-string custom
transport keys retain identity without token coercion.
Selected opaque transports retain conservative token ownership regardless of
unused native settings, preventing those settings from bypassing the guard.

```sh
node --loader ./experiments/telegraf-options-before-loader.mjs --test \
  tests/telegraf-options.test.js
node --test tests/telegraf-options.test.js
node experiments/composer-fluency-check.mjs --telegraf-options --before
node experiments/composer-fluency-check.mjs --telegraf-options
```

The immutable runner is frozen at
`8874fdbc9e59261c337e3482116e7dfadd676c31`. It reproduces 21 failures among
25 final cases; existing custom transport identity, relative custom bases and
two conflict cases already passed. The first twelve comparisons failed before
implementation.
Eight root/mode/environment combinations use actual Telegraf 4.16.3 and a finite
local HTTP server, comparing request paths, metadata and canonical file links.
Additional actual-SDK cases verify context isolation, compacted defaults and
webhook response policy. Selected-backend and bounded polling cases cover owned
extensions. Review regressions reproduce token coercion and unsafe mode values.
The public checked example produces ten diagnostics against preceding
declarations; it compiles against current declarations and actual SDK types.

All 2,223 core tests pass on Node, Bun and Deno, alongside 27 isolated native
checks, six Node 20 wire comparisons, sixteen parser-fact checks and the bounded
blocked-file probe. Strict lint, formatting, declaration/example compilation
and exact-regeneration gates pass. The duplication scan covers 166 production
sources with zero clones; the package permits 209 entries. Main remains an
ancestor, all four feedback streams are empty, and the paginated PR inventory
has no deletions. GitHub's 300-file diff limit is recorded; the complete atomic
source diff and every new fixture/example were reviewed locally.

HTTP `agent`/`attachmentAgent` options, standalone Telegram construction,
complete installed-framework/cloud integration, controlled Telegram delivery
and every wider unfinished acceptance criterion remain open. These comparisons
establish the four documented nested settings and local context contracts.
