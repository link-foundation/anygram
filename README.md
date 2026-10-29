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

Native HTTP requests validate deadlines before sending and cancel response-body
reads when the deadline or caller's signal fires. Bot API JSON responses default
to an 8 MiB limit (`maxResponseBytes` in the constructor); `downloadMedia` defaults
to 64 MiB and accepts `{ maxBytes, signal, timeout }`. MTProto HTTPS responses
default to 16 MiB (`maxBytes` in transport options). Exceeding a limit raises
`TelegramError` with type `RESPONSE_TOO_LARGE` and releases the body reader.
Bot API servers and custom networking can be selected with `baseUrl` and `fetch`.

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

`Session` can import Anygram, GramJS/teleproto, and Telethon string sessions.
Use `session.save('gramjs')` to export an authorized portable session for
GramJS/teleproto. The optional client factory uses in-memory string sessions,
loads the configured session store, and saves after a successful login.
Session strings contain authorization keys that grant account access. Keep them
private. `FileSessionStore` writes atomically with restrictive permissions on
systems supporting Unix file modes; it does not encrypt files at rest.

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
Key negotiation, re-keying and the complete secret-chat client remain unfinished.

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

## Development and evidence

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
deno test --allow-read --allow-write --allow-env --allow-net=127.0.0.1
```

The pinned schema corpus exercises all 869 methods and 1,758 non-boolean
constructors, comparing compatible layouts against actual GramJS and teleproto
serializers. Other tests cover real mtcute serialization, session import, SRP,
encrypted fake-peer exchanges, routing, Bot API requests, and bot dispatch.
Research, source snapshots, limitations, and the execution plan are in
[docs/case-studies/issue-1](docs/case-studies/issue-1).
Regenerate the schema with `npm run schema:update` and review its pinned provenance.

Original code is released under the Unlicense. Optional libraries retain their
own licenses; @mtproto/core is GPL-3.0 and is not bundled. The template's `add`,
`multiply`, and `delay` exports are retained for compatibility.

`npm run check` includes strict declaration and typed-example checking through
`tsconfig.json`, with library checking enabled. CI runs the same type check.
