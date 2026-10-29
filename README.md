# Anygram

A public-domain Telegram client with selectable backends, a shared operation
pipeline, a native Bot API transport, and an independent MTProto implementation.
This is active development toward [issue #1](https://github.com/link-foundation/anygram/issues/1).
Full ecosystem compatibility, secret chats, calls, and all downstream application
requirements are **not yet implemented or verified**. See the
[acceptance ledger](docs/case-studies/issue-1/requirements.md).

## Native Bot API

```js
import { createClient, Bot } from 'anygram';

const client = await createClient({ token: process.env.BOT_TOKEN });
await client.sendMessage(123456, 'Hello');
// Every Bot API method is available, without a hard-coded method whitelist.
await client.api.sendChatAction({ chat_id: 123456, action: 'typing' });

const bot = new Bot(process.env.BOT_TOKEN);
bot.command('start', (ctx) => ctx.reply('Ready'));
bot.on('message:text', (ctx) => ctx.reply(ctx.message.text));
await bot.start(); // Long polling; bot.stop() cancels an active request.
```

`TelegramBot` provides `on`, `once`, `onText`, and common positional methods for
legacy node-telegram-bot-api applications. `Bot` provides shared middleware,
commands, filters, context replies, and callback actions. These cover a documented
subset of those frameworks; they are not complete drop-in replacements.
`webhookCallback(bot, { secretToken })` accepts a Web Request and returns a Web
Response. Configure the same secret in Telegram's `setWebhook` request.

`bot.api.editMessageText(chat, id, text, options, signal)` and
`editMessageTextInline(inlineId, text, options, signal)` follow grammY's argument
order. `bot.telegram.editMessageText(chat, id, inlineId, text, options)` follows
Telegraf's. Context edits choose chat or inline fields directly. Bot API failures
expose `error_code`, `description`, `parameters` and `response` alongside common
`TelegramError` fields; sends are never retried automatically.

The supported positional sends, media sends, edits and context replies accept
grammY's final `AbortSignal`. Their options also accept `{ signal, timeout }`;
`timeout` is a request deadline in milliseconds. `ctx.deleteMessage(signal)`
deletes the current message, while `ctx.deleteMessage(id, options)` retains the
explicit-ID form. Raw calls keep Telegram payload fields intact, so use
`bot.api.raw.getUpdates({ timeout: 30 }, signal)` for Telegram's long-poll timeout
in seconds. See the [context control comparisons](docs/case-studies/issue-1/bot-context-controls.md).

The grammY view maps all 198 public positional helpers in the pinned SDK through
one shared translator, including polls, inline edits and deprecated aliases.
Unambiguous raw-object calls remain accepted; `.raw` accepts arbitrary payloads.
See the [positional comparisons](docs/case-studies/issue-1/bot-positional-api.md)
for the exact scope and current type-model limits.

The Telegraf view similarly maps all 125 public members of the pinned SDK,
including callback aliases, invoices, menu objects, game defaults and file URLs.
`getFileLink(fileIdOrMetadata, options)` uses the selected backend for metadata
and its configured file server. See the [Telegraf comparisons](docs/case-studies/issue-1/telegraf-positional-api.md)
for request controls, custom file roots and declaration limits.

Contexts expose the pinned update aliases, including business messages,
reactions and boosts, with `msgId`, `inlineMessageId` and `businessConnectionId`.
The two styles preserve their SDK source precedence. See the
[context data comparisons](docs/case-studies/issue-1/bot-context-data.md).

Chat delivery shortcuts preserve each SDK's business and topic defaults, caller
overrides, and dice/invoice argument order. They share the selected transport and
request controls with the positional APIs. See the [delivery comparisons](docs/case-studies/issue-1/bot-context-delivery.md)
and [typed example](examples/typed-bot-context-delivery.ts).

Chat administration helpers bind membership, invite, metadata and forum calls to
the current context. Each SDK retains its own author, topic, business and
moderation argument rules. See the [administration comparisons](docs/case-studies/issue-1/bot-context-admin.md)
and [typed example](examples/typed-bot-context-admin.ts).

User, business, managed-bot, payment, query and configuration shortcuts also
derive their identifiers from the context and retain each SDK's argument rules.
File selection and public API overrides compare against the pinned SDKs. See the
[service comparisons](docs/case-studies/issue-1/bot-context-services.md) and
[typed example](examples/typed-bot-context-services.ts).

Message actions bind edits, forwarding/copying, reactions and deletion to their
message or inline scope, including business, checklist and ephemeral identifiers.
Telegraf persistent chat actions clear their timer when the callback finishes.
See the [message action comparisons](docs/case-studies/issue-1/bot-context-message-actions.md)
and [typed example](examples/typed-bot-context-message-actions.ts).

Contexts support grammY filter queries and checker factories, with SDK-specific
entity extraction and reaction summaries/views. Telegraf also exposes text,
passport and web-app data aliases. See the [context inspection comparisons](docs/case-studies/issue-1/bot-context-filters.md)
and [typed example](examples/typed-bot-context-filters.ts).

Query shortcuts such as `bot.callbackQuery('refresh').use(handler)` return a
scoped composer. The six query shortcuts accept strings, regular expressions or
arrays and share asynchronous `filter(predicate)` registration. See the
[actual SDK comparisons](docs/case-studies/issue-1/bot-query-composer.md) and
[checked example](examples/typed-bot-queries.ts).

Register recovery with `bot.catch(({ error, ctx }) => ...)` for shared `Bot`
and `TelegramBot` instances, or `telegraf.catch((error, ctx) => ...)` for the
Telegraf view. Dispatch awaits the catcher before acknowledging an update or
admitting the next queued update. Unhandled errors and catcher failures reject;
failed updates remain available for an explicit retry. See the
[handler recovery comparisons](docs/case-studies/issue-1/bot-handler-errors.md).

Native HTTP requests validate deadlines before sending and cancel response-body
reads when the deadline or caller's signal fires. Bot API JSON responses default
to an 8 MiB limit (`maxResponseBytes` in the constructor); `downloadMedia` defaults
to 64 MiB and accepts `{ maxBytes, signal, timeout }`. MTProto HTTPS responses
default to 16 MiB (`maxBytes` in transport options). Exceeding a response limit
raises `TelegramError` with type `RESPONSE_TOO_LARGE` and releases the body reader.
Bot API servers and custom networking can be selected with `baseUrl` and `fetch`.

The unified `getMe`, `sendMessage`, `editMessage`, `deleteMessages`,
`forwardMessages` and `sendFile` methods share their translation across native,
grammY, Telegraf and node-telegram-bot-api transports. Request options `signal`
and `timeout` control preparation and dispatch without entering Telegram payloads.
For object-form `sendMessage` text, explicit third-argument options override
embedded options. Raw and extended vendor APIs remain available. See the
[actual-backend wire comparisons](docs/case-studies/issue-1/bot-operations.md).

Native Bot API uploads accept bytes, Blobs, `{ data, filename }` and
`{ source, filename }`, including nested albums and thumbnails. Use
`new InputFile(source, filename)` for explicit local paths, file/HTTP URL objects,
Node/web byte streams, byte iterators or suppliers that create fresh sources.
Plain strings remain remote IDs or Telegram-fetched URLs. Bytes, Blobs, paths,
URLs and suppliers are reusable; a direct stream-backed InputFile is single-use.
See [typed uploads](examples/typed-bot-uploads.ts).

Total attachment bytes default to 64 MiB (`maxUploadBytes`); each request accepts
up to 1000 files. Preparation uses the shared depth/vector guards and validates
the complete shape before opening sources. Deadlines and cancellation cover
preparation too. Suppliers unwrap at most sixteen steps and stream/body reading
permits at most 100000 reads. These inputs are buffered within the configured byte
limit before multipart fetch. Selected grammY, Telegraf and
node-telegram-bot-api adapters convert owned files to their vendor input types;
`createAdapter` accepts `maxUploadBytes`, `timeout` and source-download `fetch`.
The automatic factory forwards these options and can construct all three clients.
Existing vendor InputFile instances retain vendor ownership and limits.

Account `uploadFile`, `sendFile`, albums and encrypted uploads also accept owned
`InputFile` sources through raw-capable backends, including GramJS/teleproto
serializers and mtcute. Their preparation defaults to 64 MiB, further bounded by
`partSize * maxParts`; use upload options `{ maxBytes, partSize, maxParts, signal,
fetch }`. This buffer limit applies to explicit owned inputs; existing direct
bytes, Blobs and local paths retain their random-access upload behavior. Owned
uploads share a 30-second default deadline across preparation, RPC and progress;
`timeout` overrides it. See
[account upload evidence](docs/case-studies/issue-1/account-file-inputs.md).

Telegraf 4's multipart dependency stalls
on newer Node and Bun; actual wire coverage currently passes on Node 20. See the
[vendor upload evidence](docs/case-studies/issue-1/vendor-bot-uploads.md).

Request normalization checks nesting and vector limits before visiting child
values (defaults: depth 64 and 100000 vector entries). Invalid request limits,
excessive nesting and oversized vectors raise `RangeError` during conversion.

Use `bot.use(session({ initial: () => ({ count: 0 }), storage }))` to persist
`ctx.session`. Storage accepts grammY's `read/write/delete` interface or Telegraf's
`get/set/delete` interface through `store`. `grammySession` keys by chat and saves
after a successful handler; `telegrafSession` keys by sender and chat and saves
touched state even when the handler throws. `session` selects the latter style
when `defaultSession` or `store` is supplied, otherwise the former. A custom
`getSessionKey` and `property` are supported. These sessions are bot application
state, separate from account authorization sessions.

The default `MemorySessionStore` holds at most 10,000 entries with LRU eviction;
it accepts `{ maxEntries, ttl }` (TTL in milliseconds) and uses no per-key timers.
Supply persistent storage to retain data across process restarts. One middleware
instance serializes updates per key, snapshots values before handlers mutate
them and awaits persistence before dispatch completes. See the executable
[session example](examples/bot-sessions.js) and [typed bot](examples/typed-bot-session.ts).

`Composer` nests middleware, commands, text handlers and callback actions through
the same dispatch path as `Bot`. `Telegraf` provides `start(handler)` for the
`/start` command and `launch(options)` for polling. The grammY-style `Bot` uses
`command('start', handler)` and `start(options)` respectively.

`Composer` follows grammY's scope rules: `on('msg:text').use(handler)` runs the
chained handler only for matching updates. It also supports async filters,
reactions, chat types, forks, lazy routing, branches and scoped error boundaries.
Use `TelegrafComposer` (or import it as `Composer`) for Telegraf's fluent
registrations, raw-update guards and static middleware factories. `Telegraf`
and its scenes use those same fluent rules. Command handlers receive Telegraf's
`command`, `payload`, lazy `args` and `startPayload` fields. See the checked
[composition example](examples/typed-composers.ts) and
[SDK comparisons](docs/case-studies/issue-1/composer-scopes.md).

TypeScript handlers infer selected update fields and retain custom contexts.
For example, `on('message:text')` requires `ctx.message.text`, and
`ctx.has('callback_query:data')` refines the context inside its guard. Invalid
literal filter queries are rejected. See the checked
[filter example](examples/typed-filter-narrowing.ts) and
[type comparisons](docs/case-studies/issue-1/bot-filter-types.md).
Telegraf-style registrations also narrow raw updates, message subtypes and
predicate guards, including static factories and custom contexts. See the
[checked Telegraf example](examples/typed-telegraf-filters.ts).

Known Bot API methods infer their documented request and result models through
raw calls and positional helpers. For example, `bot.api.getChat(1)` returns a
`Telegram.ChatFullInfo`, and `bot.api.raw.getChat` requires `chat_id`. See the
[checked requests](examples/typed-bot-api-methods.ts) and
[method type comparisons](docs/case-studies/issue-1/bot-method-types.md).
Context helpers also retain these results: `ctx.getFile()` returns a typed file,
copy helpers return message IDs, and acknowledgement helpers return true. See the
[checked context results](examples/typed-grammy-context-results.ts) and
[SDK comparison](docs/case-studies/issue-1/bot-context-result-types.md).
Delivery and edit arguments check documented media and option fields while
preserving owned uploads, byte arrays, Blobs and source wrappers. See the
[checked upload inputs](examples/typed-bot-upload-arguments.ts) and
[argument comparison](docs/case-studies/issue-1/bot-delivery-argument-types.md).

`Scenes.BaseScene`, `Scenes.WizardScene` and `Scenes.Stage` provide persisted
conversation steps on that same middleware path. Install session middleware
before a stage; the current scene, state, expiry and wizard cursor live in
`ctx.session.__scenes`. Entry, reentry, silent entry, leave hooks, default scenes,
TTL in seconds and middleware objects are supported. A stage limits scene
transitions per update to 32 by default (`maxTransitions`), so a recursive entry
handler fails predictably. See the [typed wizard example](examples/typed-wizard.ts).

## User accounts and independent MTProto

```js
import { createClient } from 'anygram';
import { FileSessionStore } from 'anygram/storage';

const client = await createClient({
  apiId: Number(process.env.TELEGRAM_API_ID),
  apiHash: process.env.TELEGRAM_API_HASH,
  libraries: [], // Independent implementation; no Telegram client dependency.
  sessionStore: new FileSessionStore('./private/account.session'),
});
await client.start({
  phoneNumber: async () => '+1234567890',
  phoneCode: async () => readCode(), // Supply your application's input function.
  password: async () => readPassword(),
});
await client.sendMessage('me', 'Hello from MTProto');
await client.disconnect();
```

`Api` supplies class constructors for all 869 methods and 1760 constructors in
the pinned layer-232 registry, including its MTProto service definitions:

```js
import { Api } from 'anygram';
const request = new Api.users.GetUsers({ id: [new Api.InputUserSelf()] });
const users = await client.invoke(request);
await client.invoke(
  new Api.messages.SendMessage({ peer: '@alice', message: 'Hello' })
);
```

Constructors accept camelCase fields and serialize through the shared TL codec.
Numeric request random IDs are generated once when omitted; explicit zero IDs
are retained. Owned requests resolve username/ID peer shortcuts through the
selected backend, including nested requests and numeric message IDs. To serialize
a request yourself, first call `await request.resolve(client)`. Vendor custom
models and vendor reader methods remain separate compatibility work. The same
requests convert to actual GramJS/teleproto classes when those
backends are selected. Generated declarations check names, fields and TL input
types; see the [typed example](examples/typed-api.ts).

The native implementation includes RSA/DH authorization-key exchange, validated
MTProto 2.0 encrypted envelopes, HTTPS/TCP/WebSocket transports, layer 232 TL serialization,
phone/bot authorization and SRP 2FA, and a shared set of account operations.
An anonymous live handshake has been verified; live account authorization needs
application credentials and an account. DC migration, chunked media transfers,
and common/channel update recovery are covered by deterministic tests. Additional
login challenges, secret chats, call media, and live account validation remain open.

Select native TCP with `createClient({ transport: 'tcp', mode: 'intermediate' })`.
Modes are `abridged`, `intermediate`, `padded`, and `full`; the latter validates
CRC32 and packet sequence numbers. `host`/`port` override bootstrap endpoints,
and `transportFactory(dc)` supplies custom per-DC transports. `TcpTransport`
and `TransportFraming` are also exported from `anygram/mtproto`. Socket reads
have deadlines and bounded packet/byte queues. Persistent streams receive
updates directly and send acknowledgements without awaiting an HTTP response.
`await client.disconnect()` awaits asynchronous transport cleanup on every DC.
Cleanup failures are reported after all DCs have been attempted; multiple
failures are retained in an `AggregateError`.
Use `proxy: { host: '127.0.0.1', port: 1080 }` for SOCKS5 CONNECT; this selects
TCP when no transport is specified. Optional `username` and `password` must be
provided together. Domain destinations are resolved by the proxy, IPv4/IPv6
destinations are encoded directly, and negotiation shares the request deadline.
Add `socksType: 4` or `type: 'socks4a'` for SOCKS4/4a CONNECT. IPv4 destinations
are encoded directly; domain names use proxy-side SOCKS4a DNS. Its optional
`username` is a user ID of at most 255 UTF-8 bytes; IPv6 and passwords are rejected.
An explicit HTTP transport requires an injected Fetch implementation configured
for its proxy instead of the `proxy` option. `connectSocket` accepts a custom
connector and cannot be combined with `proxy`.
Use `obfuscate: true` for direct TCP obfuscation, or
`proxy: { type: 'mtproxy', host, port, secret }` for MTProxy. Secrets accept
16 bytes as hexadecimal, base64/base64url or Uint8Array; a 17-byte transport
prefix selects padded framing by default. MTProxy defaults to padded framing
and supports `dc`, `test` and `media` routing. Obfuscation supports abridged,
intermediate and padded framing. Plain padded framing alone is not obfuscation.
Select `transport: 'websocket'` for Telegram's binary WebSocket endpoint. It uses
native HTTP/TLS and obfuscation, masks outgoing frames, handles fragmented
binary streams and ping/pong, and validates the upgrade and TLS certificates.
`url` overrides the endpoint, `ca` adds a private test certificate authority,
and SOCKS4/4a/5 proxies remain available. `WebSocketTransport` and `WebSocketFraming`
are exported from `anygram/mtproto`. This transport requires Node-compatible
network APIs; browser/Worker support remains open.
Fake TLS and obfuscated full framing remain unfinished.
The [typed transport example](examples/typed-transports.ts)
shows the supported construction options.

The native `Mtproto.callWithReceipt(method, params, options)` returns
`{ value, messageId, dc }` after a successful RPC. Pass accepted client IDs from
the selected data center in `afterMessageIds` to wrap the next call in
`invokeAfterMsgs`. Lists are copied before queuing and limited to 1000 distinct
IDs. The receipt identifies the accepted salt-retry attempt and final data center;
explicit migration clears dependencies belonging to the previous data center.
Generic wrappers retain the inner method's result type, including vectors.
The [ordered secret RPC example](examples/typed-ordered-secret-rpc.ts) chains
previously persisted encrypted frames. An ambiguous network failure still rejects
without automatic replay; durable outbox recovery remains the caller's job.

Use `for await (const entry of client.iterDialogs(options))` to stream account
dialogs across pages through the shared MTProto implementation. Each entry has
canonical TL `dialog`, `entity`, `inputPeer` and optional top `message` objects.
Messages are matched by peer and ID; yielded objects are copied. `pageSize`
defaults to 100 (maximum 100), `limit` bounds yielded entries, and `maxPages`
defaults to 1000 (maximum 10000). Repeated cursors stop the scan; exhausting the
request budget rejects with `DIALOG_PAGE_LIMIT`. `folderId: 0 | 1` selects main
or archived chats. Date/ID/peer offsets, pinned exclusion, cancellation and
early iterator closure are supported. `getDialogs` retains its existing backend
return value. The [typed dialog example](examples/typed-dialogs.ts) builds a
group membership index and applies mute/archive with the returned access hashes.

`parseTelegramLink(text, { domains })` identifies public usernames, invite hashes,
phone links and public/private message links without network requests. It handles
`t.me`, `telegram.me`, `telegram.dog`, valid username subdomains and `tg:` forms;
`domains` explicitly allows additional hosts from Telegram's `me_url_prefix`.
Message/thread IDs are validated integers and private channel IDs remain bigint.
Unsupported link kinds and malformed or untrusted URLs raise `TypeError`.
Shared `joinChat` and peer resolution use this parser. Private message links
resolve only through a previously loaded access hash and cannot grant membership;
`joinChat` raises `INVITE_REQUIRED`. Numeric phone links resolve through
`contacts.resolvePhone` and cannot be imported as invites. Layer-232 successful
join replies retain their wrapper and cache the nested peers for later settings.
Approval errors and verification replies remain explicit server outcomes.

`checkChatInvite(hash, options)` inspects a private invite without joining and
caches an already-member or preview chat's access hash. `getNotifySettings(peer,
options)` reads current preferences for a peer or a canonical `InputNotifyPeer`.
`muteChat(peer, options)` sets `until` (Unix seconds, default 2147483647), optional
`showPreviews`, `silent`, `sound`, `storiesMuted`, `storiesHideSender` and
`storiesSound`. Explicit `false` and `until: 0` are preserved; omitted preferences
remain absent from the request. Nested sound objects are copied before lookup.

The [follow workflow](examples/follow-groups.js) scans existing groups, follows
up to 1000 public/private links, optionally mutes and archives confirmed members,
and provides group listing, recent history and leave helpers. Invite membership
is checked after joining before applying settings. Results distinguish existing
membership, accepted joins, approval requests and required verification, and
retain completed settings if a later operation fails. Flood waits stop the batch
by default; `continueOnFloodWait` processes later links without replaying or
waiting on the failed operation. Capacity errors always stop. The application
owns durable progress, deliberate retries and user interaction for verification.

The [follow command example](examples/follow-cli.mjs) runs after `npm install`
in this repository:

```sh
node examples/follow-cli.mjs '(telegramLinks: t.me/first t.me/second)' --mute --archive
node examples/follow-cli.mjs join https://t.me/first --info --messages --json
node examples/follow-cli.mjs list --json
node examples/follow-cli.mjs leave @first
```

It accepts space-separated arguments, multiline stdin, or the existing
`~/.follow/telegram-links.lino` cache. Inside Links Notation, quote references
containing URL schemes. Input is limited to 256 KiB, 1000 links and 4096 characters
per link. `--delay` sets 0–3600 seconds between links (default 2); cancellation
interrupts pacing. `--skip-rate-limit` continues with later links without replay.
`--backend` selects native, GramJS or teleproto for this example.
Existing plaintext `.env` keys `TELEGRAM_USER_BOT_API_ID`,
`TELEGRAM_USER_BOT_API_HASH`, `TELEGRAM_USER_BOT_PHONE` and `TELEGRAM_USER_SESSION`
are recognized; process environment takes precedence. Interactive login prompts
hide secrets. Authorized sessions are saved through `FileSessionStore` to
`~/.follow/telegram-session` before application work; the existing `.env` is
preserved. Saved sessions take precedence over the imported environment session.
Use `--env-file`, `--session-file` and `--cache-file` for explicit paths. Piped
commands require a reusable authorized session; interactive login needs a terminal.
`--json` writes one JSON result after cleanup, and `--debug` writes only request
metadata to stderr. Pending approval remains explicit; invalid links, failed work,
verification requirements, flood stops and exhausted cleanup yield failure status.
Group listings retain raw `id` values and include an exact `markedId` usable by
the leave command, including private channels without usernames.

The [follow application bridge](examples/follow-client.js) also supports
standalone `connect()`/`disconnect()` around its account helpers. It holds the
same owned connection scope used by `withConnection()`. Always await
`disconnect()` in `finally`; cancellation initiates cleanup and its failure
remains observable there. Callback-owned work rejects manual disconnection.
The bridge accepts a configured Anygram account. The
[original-constructor migration](examples/telegram-user-client.js) instead accepts
follow's `apiId`, `apiHash`, `phone`, `session` and environment configuration:

```js
import TelegramUserClient from './examples/telegram-user-client.js';
const account = new TelegramUserClient();
await account.withConnection(async (client) => {
  console.log((await client.getMe()).firstName);
});
```

It defaults to the native backend and builds a fresh account for each scope.
It saves authorized sessions as GramJS-compatible strings in `.env` before work;
explicit `saveSession()` updates the same store. Unrelated settings and comments
are retained, multiline values are respected, and writes use the atomic private
file writer. Configuration reads/writes are limited to 256 KiB. `envFile: false`
disables default disk persistence; `sessionPath` or `sessionStore` selects another
store. `backend: 'gramjs'` or `'teleproto'` also supplies the vendor's `Api`
namespace to callbacks. Native callbacks can use tagged requests or an explicitly
supplied `Api`, and default to the shared native `Api` namespace. Full vendor
client methods remain compatibility work. This constructor is separate from the CLI's portable-file
persistence policy.

`client.withConnection(async (connected) => { /* account work */ }, options)`
opens one selected backend and awaits cleanup before returning. The callback
receives a client pinned to that backend. Supplying `start: { ...loginOptions }`
uses `start` instead of `connect`; `signal` cancels setup and is available to pass
to operations. Cleanup ignores cancellation, attempts `disconnect` and then
`destroy` when supported, and retries each failed stage up to `cleanupAttempts`
(1–3, default 3), with `cleanupDelay` milliseconds between attempts (0–1000,
default 100). Login and application work run once. An exhausted stage raises an
`AggregateError` retaining every failed attempt, plus the original application
error when present. Overlapping scopes on the same backend reject before opening
another connection. Destruction may permanently close the underlying client;
create another client for a later independent scope. The
[typed account scope](examples/typed-account-scope.ts) demonstrates login,
dialog iteration and inferred callback results.

`Session` can import Anygram, GramJS/teleproto, and Telethon string sessions.
Use `session.save('gramjs')` to export an authorized portable session for
GramJS/teleproto. The optional client factory uses in-memory string sessions,
loads the configured session store, and saves after a successful login.
Session strings contain authorization keys that grant account access. Keep them
private. `FileSessionStore` writes atomically with restrictive permissions on
systems supporting Unix file modes; it does not encrypt files at rest.
Reads and writes default to a 16 MiB UTF-8 byte limit; pass `{ maxBytes }` as the
second constructor argument to set a smaller limit. Oversized writes preserve
the previous file. `store.load({ signal })` checks cancellation before opening
and between bounded reads. Follow account session files use an 8 KiB limit.
`readTextFile(path, { maxBytes, signal })` from `anygram/storage` provides the
same bounded reader for other text files; it propagates missing-file errors.

For QR login, pass `qrCode: async ({ url, expires }) => displayQr(url, expires)`
to `client.start`. Anygram refreshes tokens, imports the login on the requested
data center, and requests `password` when Telegram requires 2FA. `signal`,
`qrTimeout` (milliseconds, default five minutes), and `maxQrAttempts` bound the
flow. Rendering the QR code is the application's responsibility.

Phone login passes a copy of the sent-code challenge to `phoneCode(challenge)`.
For login email challenges, provide `emailCode(challenge)`; `phoneCode` is its
fallback. Email setup additionally asks `email(challenge)`, verifies it and uses
the new code hash returned by Telegram. `emailVerification` accepts a code proof
or a callback returning a Google/Apple ID token proof when Telegram allows that
provider. The application obtains provider tokens. `maxLoginSteps` (default 10,
maximum 1000) bounds successive setup challenges; `signal` cancels network steps.
Use `onCode(challenge)` to choose code delivery before any phone/email prompt.
Return nothing to continue, `{ action: 'resend', reason? }` to request Telegram's
advertised `next_type`, or `{ action: 'cancel' }` to cancel the current code and
reject with `LOGIN_CANCELLED`. The callback receives a copy; resends retain the
current code hash and subsequent sign-in uses the new returned hash. Each resend
counts toward `maxLoginSteps`. The application honors `challenge.timeout` before
offering another delivery method; server errors propagate without replay.
See `examples/typed-code-delivery.ts` for the UI callback boundary.
The [typed email login example](examples/typed-email-login.ts) shows private
application prompts. Official-app-only payment and Firebase flows remain outside
this high-level helper.

```js
// After authorization. Use a separate file for update cursors, not the session.
const updates = client.runUpdates({
  stateStore: new FileSessionStore('./private/updates.json'),
  onUpdate: async (update) => handleUpdate(update),
  onReset: async (reset) => rebuildHistory(reset),
});
// At shutdown:
await client.stopUpdates();
await updates;
```

Update handlers finish before their cursors are saved. Delivery can repeat after
handler or persistence failures; application side effects should be idempotent.
`stopUpdates()` requests cancellation; awaiting the `runUpdates()` promise drains
accepted handlers and their saved cursors before restoring the previous handler.
Cancellation during initial or scheduled recovery also stops cleanly. Other
handler, persistence and polling failures still reject that promise; independent
failures are retained in an `AggregateError`. At most 1000 handler failures are
retained between drains, followed by an explicit overflow error.
`onReset` reports a missing initial channel cursor or a difference too old for
server recovery. `watchedChannels` takes IDs of up to ten currently open channels;
provide `resolveChannel` when their access hashes are absent from saved state.
`watchChannel` and `unwatchChannel` change that set while recovery runs. One
polling-loop clock follows server timeouts and recovers common state after
fifteen minutes without pushes. Watched channels use Telegram's one-second
fallback when a final difference omits its timeout. A standalone `UpdateManager` needs periodic
`tick()` calls from the application's existing loop.
`uploadFile`, `iterDownload`, `downloadMedia`, `sendFile`, and `sendAlbum`
share chunking and bounds across raw MTProto backends. Downloads accept
`refreshFileReference` to refetch an expired reference from its original message.

`anygram/mtproto` exports `SecretChatCodec` for the independently versioned
end-to-end TL schema. It writes the constructor version for the selected
`{ layer }` (default 144) and reads historical versions through that layer.
`npm run schema:update:secret` regenerates it from Telegram's TL text, retaining
flag-only fields omitted by the JSON schema. An optional captured Markdown path
allows offline regeneration.

`SecretChatCipher` provides MTProto 2.0 end-to-end
envelopes over those serialized bytes. Its constructor requires
a 256-byte shared key and `{ originator: boolean }`; the direction is relative
to the original chat creator. It checks fingerprints, message integrity, length
and padding, with a configurable `maxBytes` up to the default 16 MiB. `destroy()`
clears its owned key bytes and disables further use. This primitive requires
separate chat negotiation, layer agreement, sequence tracking, persistence and re-keying;
the high-level secret-chat client remains unfinished.
The default envelope `version` is 2. Explicit `{ version: 1 }` supports the
deprecated format required during initial negotiation with a peer whose layer
is below 73. Each cipher accepts only its selected version. The integrated
client must enforce Telegram's sequence-based switch to version 2 and reject
later downgrades; selecting the legacy primitive does not perform that policy.

`SecretChatSequence` tracks role-specific sequence numbers and acknowledgements,
buffers gaps, requests missing ranges once and returns exact cached frames for
resends. `receive()` accepts only authenticated, decoded layer messages. Its
result separates ordered messages, retransmissions and a new resend request.
Limits bound history, pending frames and their combined bytes; protocol errors
abort the tracker. `exportState()` produces a JSON snapshot for the constructor's
`state` option. It contains plaintext messages and needs protected storage.
Persist each snapshot together with its returned effects atomically before
sending or acknowledging them. `unacknowledged()` and `resendRequest()` recover
outgoing work after restart. See `examples/typed-secret-chat.ts` for a send using
a separately negotiated chat/key. `deleteUnacknowledged(outSequence, deletionId?)`
replaces the cached outgoing text/media with a self-deletion at its original
sequence and returns a second deletion service at the next sequence. Persist
both effects with the new snapshot, remove old persisted plaintext and release
application-owned copies. Capacity failures leave cached state unchanged.
`upgradeLayer(layer)` changes the serialization of future messages. Earlier
cached frames keep their exact bytes and headers through resends, deletion and
restart; layer downgrades are rejected. Send the required layer notification
and persist the upgraded snapshot as part of the application's negotiation.
Integrated layer negotiation, re-keying and the complete secret-chat client
remain unfinished.

`createSecretChatKeyExchange(invoke, { config? })` refreshes Telegram's DH
configuration before generating a pending exchange. It validates the 2048-bit
safe prime, generator and peer public value, and mixes local CSPRNG bytes with
server randomness. `exchange.publicValue` is the value sent to the peer;
`exchange.complete(peerPublic, expectedFingerprint?)` returns the 256-byte key
and signed 64-bit fingerprint, then destroys its owned private exponent.
`exchange.exportState()` supports pending-exchange recovery through the
`SecretChatKeyExchange` constructor's `state` option. This snapshot contains a
private exponent and requires protected storage. The primitive does not yet
perform request/accept RPCs, layer agreement or PFS rotation.

`SecretChatLayers` tracks a peer's highest known layer, required notifications
and the sequence boundary after which only version-2 envelopes are valid.
It starts with peer layer 46; `outgoing` selects the compatible layer/version.
Call `observe(frame, version)` only for authenticated frames accepted by sequence
checks, excluding duplicates. Pass `{ ordered: false }` for a queued gap, then
observe its service action when delivered in order. Queue `notification()` in
durable outgoing state before `markNotified()`. Persist `exportState()` with
sequence state. Downgrade errors require aborting the chat. The policy does not
perform RPCs or replace the complete secret-chat client.

`createSecretChatRequest(invoke, { selfId, user, config? })` prepares an initial
DH request. `user` is an `inputUser` or `inputUserFromMessage` with an exact
`user_id`. Call the returned `handshake.submit(invoke, { save })` to persist the
private exponent and deduplication/chat ID before sending the request RPC.
`createSecretChatAcceptance(invoke, { selfId, chat, config? })` prepares acceptance
of an `encryptedChatRequested`; call it after the application has explicitly
accepted the request. Its `submit()` saves the derived key before the accept RPC.
Both helpers refresh DH configuration and return it for subsequent caching.

Feed matching `updateEncryption.chat` objects to
`handshake.apply(invoke, chat, { save })`. It verifies chat/participant bindings,
the peer public value and final fingerprint, saves the completed state and then
enables `credentials()`. Invalid key exchanges discard the chat and clear owned
key material. Unrelated chat IDs leave its pending exchange intact. A final
storage failure keeps credentials unavailable until a successful save. Protected
JSON snapshots restore through `new SecretChatHandshake({ state })`; lost
requests retain their exact random ID/public value, and lost acceptances retain
their key. An already-accepted RPC error needs the corresponding recovered
encryption update before readiness can be verified. `destroy()` clears local
owned key material; callers manage persisted copies.

`new SecretChatSession(handshake.credentials())` combines the key, sequence,
layer policy and a durable encrypted outbox. Every operation requires a
`save(state, effects)` callback: commit the snapshot and received message effects
in one transaction. `queue(message, { save })` automatically queues a layer
notification when needed. `flush(nativeClient, { save })` submits pending packets
in order using actual RPC message receipts and `invokeAfterMsgs`. Network or
post-RPC save failures retain the exact encrypted packet and its random ID for
retry. Restore protected JSON through `new SecretChatSession({ state })`.

For each `updateNewEncryptedMessage`, await
`session.receive(update.message.bytes, { file: update.message.file, date: update.message.date, save })` before advancing the account
qts cursor. Then flush any queued notifications or gap requests. Received
messages may repeat after a failed save; the atomic transaction prevents their
effects from being committed separately from sequence state. Authenticated
protocol violations clear owned key/message state and save an aborted snapshot;
`flush()` then durably retries `messages.discardEncryption`. Unauthenticated
packets leave active state unchanged. Serialize operations on each session;
overlapping operations reject. See `examples/typed-durable-secret-chat.ts`.

`queueService(action, { save, randomId? })` queues read, delete, screenshot,
history-clear, typing and TTL actions through the same durable outbox. Read,
delete and screenshot lists retain exact signed 64-bit random IDs, deduplicate
IDs and accept at most 1000 entries. A TTL service changes `state.messageTTL`
atomically; future messages with an omitted `ttl` use that default. An explicit
`ttl: 0` disables expiry for that message. Default settings range from zero to
one year; explicit message lifetimes retain the positive TL integer range.
Incoming settings follow official peer clamping and change defaults
only when delivered in sequence. Received service actions accompany ordered
message effects for application history and expiry handling. See
`examples/typed-secret-services.ts`.
Application delete/history-clear actions also replace matching unacknowledged
text and attachment frames with self-deletions before queueing the new action.
This preserves their sequence/key boundaries while removing their contents from
retransmissions. Delete/history actions release acknowledged protocol caches as well.
`pruneAcknowledged({ save })` explicitly releases acknowledged plaintext and
ciphertext without moving sequence counters. Incoming history actions do not
reset protocol sequence state.

`SecretChatLifetimes` retains bounded expiry metadata separately from the
protocol retransmission state. Track each expiring message with its server date,
direction and a `startOn: 'read' | 'open'` trigger before processing receipts.
Outgoing successful saves include `effects.sent` with each exact message body,
random ID, sequence and server date; commit these with submitted state and
application history. Incoming ordered message effects retain the original
`date`, including through sequence gaps and JSON restart. Pass the update's
server date to `receive()`; older snapshots without it preserve `undefined`.
These server dates are outside the peer's end-to-end encrypted envelope.
Use `readThrough(maxDate, { outgoing, at })` for history reads and
`read(ids, { outgoing, at })` for opened content. Pass remote
`updateEncryptedMessagesRead.max_date` and `.date` with `outgoing: true`; local
reads use `false`. Audio/video lifetime includes its playback duration plus one
second. Duplicate reads preserve the first deadline, including after restart.
`expire(now)` returns due metadata for transactional deletion from application
storage; `nextExpiration` permits one shared scheduler with no message timers.
Snapshots contain exact IDs and times, without plaintext or file keys. Persist
the timer draft and delete stored messages, thumbnails and cached files in one
transaction. `applyService()` processes ordered incoming read/delete/history
actions; its removed entries cover tracked TTL metadata only. Also delete
nonexpiring application history named by delete/history actions. See
`examples/typed-secret-expiry.ts` for transaction and scheduler callbacks.

The default limits retain at most 1000 incoming gaps, 1000 outgoing frames and
16 MiB of combined plaintext/ciphertext. Acknowledged history can be released
under pressure; unacknowledged frames cannot be silently evicted. Snapshots
contain keys and plaintext and require protected storage. `destroy()` clears
owned memory, while applications manage their stored and returned copies.
Initial handshakes retain the original DH parameters and key creation time in
their credentials. Opening a session later preserves the key's age.
These enable compulsory PFS in the session: activity starts an exchange after
more than 100 sent/received messages or seven days of a key used for encryption.
`rotateKey(undefined, { save })` can also start an exchange explicitly. The
session persists pending exponents, candidate keys, service actions and cached
ciphertext together. Signed simultaneous exchanges and missing commits follow
the same policy as ordered service messages. A new-key packet must authenticate
and pass sequence checks before it proves a switch. The previous key is erased
after that proof and closure of preceding incoming gaps. `visualization`
returns copied original-key hashes, which remain stable through rotations.

Exact old ciphertext remains available for retransmission after its key is
erased. Each queued user message also retains a prepared self-deletion packet
under its original key; deleting an unacknowledged message swaps that packet
into the original sequence position and queues a separate current-key deletion.
Both packets count toward the combined buffer budget. Version-1 snapshots remain
readable, and all new snapshots use version 2. Earlier completed handshakes that
lack original DH parameters remain single-key sessions; fresh manually supplied
credentials must include `dh: { p, g }` to enable PFS. Controlled live-account
interoperability remains unfinished.

`uploadEncryptedFile(invoke, source, options)` encrypts a byte buffer, Blob or
local path using a fresh one-time file key and IV. It returns `{ file, key, iv,
size, name }`; place the key, IV and original size inside the encrypted media
body and pass `file` to `session.queueFile(message, file, { save })`. The helpers are also
available on `Anygram` through raw-capable backends. Uploads share bounded
sequential parts with cloud files; small-file MD5 checksums cover ciphertext.
`iterDownloadEncryptedFile(invoke, { file, key, iv, size }, options)` downloads
from the file's DC, decrypts continuous IGE blocks and removes final padding.
It defaults to a 512 MiB limit; the collecting `downloadEncryptedFile` defaults
to 64 MiB. Both accept cancellation and progress callbacks. IGE provides no file
MAC: the fingerprint checks key/IV consistency. Obtain the key, IV and original
size from the authenticated secret body and the file reference from its Telegram
update. See `examples/typed-secret-files.ts`.

The session binds uploaded or reusable file references to its durable outbox.
`flush()` sends them with `messages.sendEncryptedFile` and saves returned file
references in `effects.files` with the submitted state. Save these effects in the
same transaction as received messages and state. Incoming out-of-order file
references survive protected JSON restart and accompany `effects.messages` when
their gap closes. Attachment bytes count toward session buffer limits. Cached
reference digests detect inconsistent snapshots; they are not file MACs.
Photo, video, audio and document metadata are validated against their encrypted
file fingerprints and sizes. The initial legacy layer accepts only 32-bit
document sizes; oversized documents reject until a newer layer is negotiated.

`SecretChatRekey` provides the separate ordered PFS action state machine using
the original chat's DH parameters. `request()` starts one exchange;
`receive(action)` returns actions and optional key installation. Its
`installBeforeActions` flag keeps the initiator's commit under the old key and
the recipient's noop under the new key. `candidate` allows authentication of
a new-key message when the commit is missing; call `confirm(fingerprint)` only
after successful authentication. Signed exchange IDs resolve simultaneous
requests, and accepted/committed local exchanges cannot be aborted locally.

`record({ sent, received })` and `shouldRotate()` implement the usage and key-age
thresholds. Protected snapshots retain pending exponents or candidate keys.
Work on a restored draft and persist actions, sequence and key changes together;
see `examples/typed-secret-rekey.ts`. `SecretChatSession` integrates this policy
automatically when its original DH parameters are available.

`SecretChatKeyRing` owns the current key and at most one previous generation.
Authentication of a candidate does not install it. After sequence validation,
`observe(fingerprint, counter)` records an accepted frame, excluding duplicates.
`retire(incomingCounter)` erases the old key only after new-key proof and the
preceding incoming gaps have closed. Downgrades across that boundary reject.
Snapshots retain the original visualization hashes after old keys are erased.
`decryptOutgoing()` returns `undefined` for ciphertext whose key is retired;
applications may keep exact ciphertext for retransmission without keeping that
key. The active session integrates this policy with durable state and its outbox.

## Select existing clients

```js
import { Anygram, createAdapter } from 'anygram';
import { Api } from 'telegram';

const client = new Anygram({
  adapters: [createAdapter('gramjs', initializedGramJsClient, { Api })],
  backend: 'gramjs',
});
await client.sendMessage('me', 'Unified call');
await client.invoke('messages.getHistory', {
  peer: new Api.InputPeerSelf(),
  offset_id: 0,
  offset_date: 0,
  add_offset: 0,
  limit: 10,
  max_id: 0,
  min_id: 0,
  hash: 0n,
});
// Bound access to the complete installed backend's original API.
await client.backend().getMe();
```

Adapters support GramJS, teleproto, mtcute, @mtproto/core, grammY, Telegraf, and
legacy node-telegram-bot-api invocation styles. TDLib uses a different schema;
its original client is accessible through `backend()`, but cannot execute MTProto
requests. Install optional backends yourself; they are not runtime dependencies.
For automatic lazy construction, use `createClient({ libraries: ['gramjs'], ... })`.
Select explicitly with `backend` or `withBackend(name)`; failures never silently
replay side effects against another backend. Native fallback is enabled by default
and can be disabled with `native: false`.

Use string RPCs, TL objects (`{ _: 'users.getUsers', id: [...] }`), class requests,
or `client.raw.users.getUsers({ id: [...] })`. Integers outside the safe Number
range require bigint or decimal strings. Original-library return objects can
differ; full cross-library return-model compatibility is not claimed.

`client.gramjs` and `client.teleproto` share account migration helpers:
`getMe`, `getEntity`, `getInputEntity`, `getMessages`, `iterMessages`,
`getDialogs` and `iterDialogs`. `invoke` and `sendMessage` use the same detached
result conversion. Their TL data uses camelCase fields,
`className` tags and exact native bigint IDs. Dialogs include `entity`,
`inputEntity`, peer-qualified `message`, marked `id`, names, folder/unread fields
and user/group/channel flags. Dialog collection uses bounded shared pagination;
request options and cancellation reach the selected backend. These are plain
data views; vendor custom model methods, drafts, array totals, legacy big-integer
methods and `instanceof Api.*` behavior require the original `backend()` API.
Direct `client.invoke` keeps raw backend results. Native send results can still
be Updates containers; complete vendor message-result correlation remains open.

The [follow migration bridge](examples/follow-client.js) adapts a configured
account to follow's application helpers, preserving owned connection cleanup,
join-result shape, notification fields and exact peer identity. Regression tests
execute its pinned follow batch and join/list/leave application classes against
the bridge; native TCP and actual GramJS/teleproto constructors cover the batch.
Pass login callbacks through `scope.start` and persistence through `createClient`.
The bridge does not load or rewrite `.env`, prompt, or implement the upstream
CLI flags. Those entry points and controlled-account validation remain open.

## Development and evidence

The [community posting example](examples/community-posts-cli.mjs) runs the
original Russian menu, channel publication and lifting flow with independently
selected bot and account transports:

```sh
node examples/community-posts-cli.mjs --help
node examples/community-posts-cli.mjs --bot-backend grammy --account-backend gramjs
```

It retains the original `token` file and `community_posts` channel default;
account search additionally needs authorized account API credentials. Prompts,
24-hour limits and publication/cleanup intents persist across restarts.
Replacements publish before old posts are deleted. `/cancel` removes pending
input, and `/status` reconciles uncertain delivery without automatic replay.
See [setup, bounds and verification](docs/case-studies/issue-1/community-posts.md)
before running one process per token and journal. Local native/vendor evidence
does not verify live channel permissions or Telegram search indexing.

Compose text with Telegram entities without parsing user input as markup:

```js
import { bold, fmt, formatTemplate } from 'anygram';
const greeting = fmt`👋 Hello ${bold('Ada 🚀')}!`;
await client.sendMessage('me', greeting);
// Localized strings can be loaded at runtime; formatting survives insertion.
const localized = formatTemplate('👋 Hello {name}!', { name: bold('Ada') });
// Bot context replies/edits and text/caption API fields accept formatted text.
await bot.api.sendMessage(chatId, localized);
```

`FormattedText` (`FormattedString`), `fmt`, paired tags such as
`` fmt`${bold}hello${bold}` ``, and chain methods share immutable text/entity
values. Offsets use UTF-16 as required by Telegram. Incoming text and captions
retain their entities when interpolated. Invalid nesting and out-of-range
entities fail locally. Bot requests use explicit entities; shared MTProto
operations translate them to TL constructors. See
[the runnable localized greeting example](examples/formatted-greetings.js).

Bot polling permits one active instance per token/server in a process. Stop and
await the existing poller before replacing it. HTTP 409 from another process is
surfaced to the application; deployments need a single polling owner or a shared
lease. For membership changes, explicitly subscribe with
`allowed_updates: ['chat_member']` and grant the bot the required administration
rights; large groups do not reliably supply join service messages.

Account operations also expose `getInputEntity`, `getContacts`,
`getGreetingStickers`, `downloadFile`, and `downloadProfilePhoto`. Downloads of
message documents use the advertised size and can refresh expired file references
by reloading the original message. For other origins, provide
`refreshFileReference`; refreshes are bounded and never resend a message.

Node >=20.18.3 is required. Tests also run on Bun and Deno.

```sh
npm install
npm test
npm run check
npm run typecheck
bun test
deno test --allow-read --allow-write --allow-env --allow-net=127.0.0.1 --allow-run=git
```

The pinned schema corpus exercises all 869 methods and 1,758 non-boolean
constructors, comparing compatible layouts against actual GramJS and teleproto
serializers in both directions: 1,931 GramJS layouts and 2,623 teleproto layouts.
Protocol class names such as `ReqPqMulti` and `PQInnerData` resolve to their
schema names. Fixed-width `int128`/`int256` fields accept exact byte arrays or
big integers, including legacy GramJS values. Signed values and unsigned nonce
bit patterns are preserved; overflow and JavaScript numbers are rejected.
Decoded fixed-width fields remain owned little-endian byte arrays. These wire
comparisons do not establish call-media or production account interoperability.
Other tests cover real mtcute serialization, session import, SRP,
encrypted fake-peer exchanges, routing, Bot API requests, and bot dispatch.
Research, source snapshots, limitations, and the execution plan are in
[docs/case-studies/issue-1](docs/case-studies/issue-1).
Regenerate the schema with `npm run schema:update` and review its pinned provenance.

Original code is released under the Unlicense. Optional libraries retain their
own licenses; @mtproto/core is GPL-3.0 and is not bundled. The template's `add`,
`multiply`, and `delay` exports are retained for compatibility.

`npm run check` includes strict declaration and typed-example checking through
`tsconfig.json`, with library checking enabled. CI runs the same type check.

Message replies and raw calls retain their content fields through public
`Telegram.Message` subtype names, including photo sizes, text and animation
documents. [Checked examples](examples/typed-grammy-message-subtypes.ts) and
[comparison evidence](docs/case-studies/issue-1/bot-message-subtype-types.md)
describe the supported result refinements.
