# File inputs through optional Bot API clients

The previous adapter forwarded owned InputFile objects directly. Actual grammY
and Telegraf JSON encoders rejected their `toJSON`; the pinned
node-telegram-bot-api 2.1.0 client was unsupported because it exposes `request`
rather than the legacy `_request`. `tests/vendor-bot-upload.test.js` retains
seventeen portable cases, beginning with actual-client failures before the change.

The shared collector and sequential file reader now serve native multipart and
optional adapters. Complete structural checks precede opening sources; all owned
files in one request share an aggregate byte budget. The adapter converts bounded
bytes to actual grammY/node-telegram-bot-api InputFile instances or Telegraf Buffer
wrappers. Unique internal symbols identify replacements, so literal
`attach://file0` text is never mistaken for an owned attachment. Filenames and
bytes survive nested media. Existing vendor instances retain their prototypes,
private state and vendor cleanup/limit behavior. The owned limit does not inspect
opaque vendor instances. Telegraf controls the MIME headers of its own wrappers.

Preparation and vendor dispatch share a deadline/caller signal. Blocked suppliers
reject without reaching the vendor; supported late source cleanup still runs.
The selected backend executes once and no other backend retries a failed send.
A noncooperating vendor request stops being awaited on cancellation; the vendor
owns its underlying network cleanup. Legacy `_request` clients receive explicit
`formData` parts and JSON structured fields; this legacy contract is mocked,
whereas pinned 2.1.0 uses its actual request and multipart encoder.

`createAdapter` accepts `maxUploadBytes`, `timeout` and source-download `fetch`.
The automatic factory forwards these options and constructs the current
node-telegram-bot-api Bot as well as grammY/Telegraf. Its client-specific network
configuration remains under `clientOptions`. Vendor-specific retry behavior is
unchanged; applications choose it through those options.

The finite local HTTP fixture captures at most eight requests of 64 KiB each and
has a three-second socket limit. An independent fixture parser verifies captured
multipart bytes, filenames, nested references and literal text. Core tests execute
actual grammY and node-telegram-bot-api encoders on Node, Bun and Deno; Telegraf
conversion checks reach an actual Telegram instance's intercepted API boundary.
Two separate actual Telegraf wire integrations run on Node 20 in CI:

```sh
node --test tests/vendor-bot-upload.test.js
node --test experiments/vendor-bot-wire.integration.js
```

The latter suite currently passes on Node 20.18.3. It reproduces an upstream
Telegraf 4.16.3/sandwich-stream 2.0.2 incompatibility on Node 26.12.1 and Bun 1.4.4:
only the first multipart fragment reaches the server before cancellation. The
same failure occurs with an original vendor Buffer wrapper. The finite standalone
`experiments/telegraf-multipart-probe.mjs` isolates unread buffered bytes in its
first part; it exits after one second and can run with a 64 MiB heap/512 KiB stack.
This adapter change does not repair that vendor encoder. Its full runtime parity
remains an unfinished R05/R08/R17/R19 criterion. Deno wire behavior for that vendor
also remains unverified. No account or live Telegram token is used.

This checkpoint advances R01/R03/R05/R08/R13/R16/R17/R18/R19. The later
[account-input checkpoint](account-file-inputs.md) adds cloud/album/encrypted
owned sources through raw backends. Unbuffered multipart, complete browser/Worker
support and all other unmet criteria remain open. Local validation and current CI are recorded in the work plan and
PR description; raw method support alone does not complete the feature union.
