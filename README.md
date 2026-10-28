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
MTProto 2.0 encrypted envelopes, HTTPS transport, layer 232 TL serialization,
phone/bot authorization and SRP 2FA, and a shared set of account operations.
An anonymous live handshake has been verified; live account authorization needs
application credentials and an account. Additional login challenges, DC migration,
and reliable updates recovery remain under development.

`Session` can import Anygram, GramJS/teleproto, and Telethon string sessions.
Session strings contain authorization keys that grant account access. Keep them
private. `FileSessionStore` writes atomically with restrictive permissions on
systems supporting Unix file modes; it does not encrypt files at rest.

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

Node >=20.18.3 is required. Tests also run on Bun and Deno.

```sh
npm install
npm test
npm run check
bun test
deno test --allow-read --allow-write --allow-env
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
