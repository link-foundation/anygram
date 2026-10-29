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
`session.receive(update.message.bytes, { save })` before advancing the account
qts cursor. Then flush any queued notifications or gap requests. Received
messages may repeat after a failed save; the atomic transaction prevents their
effects from being committed separately from sequence state. Authenticated
protocol violations clear owned key/message state and save an aborted snapshot;
`flush()` then durably retries `messages.discardEncryption`. Unauthenticated
packets leave active state unchanged. Serialize operations on each session;
overlapping operations reject. See `examples/typed-durable-secret-chat.ts`.

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
body and pass `file` to `messages.sendEncryptedFile`. The helpers are also
available on `Anygram` through raw-capable backends. Uploads share bounded
sequential parts with cloud files; small-file MD5 checksums cover ciphertext.
`iterDownloadEncryptedFile(invoke, { file, key, iv, size }, options)` downloads
from the file's DC, decrypts continuous IGE blocks and removes final padding.
It defaults to a 512 MiB limit; the collecting `downloadEncryptedFile` defaults
to 64 MiB. Both accept cancellation and progress callbacks. IGE provides no file
MAC: the fingerprint checks key/IV consistency, and file metadata must come
from the authenticated secret message. See `examples/typed-secret-files.ts`.
Durable attachment submission and incoming gap handling remain the next steps.

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
