# Account request media shortcuts

[PR #2](https://github.com/link-foundation/anygram/pull/2) adds four missing
request autocasts shared by the installed GramJS 2.26.22 and teleproto 1.232.0:
InputPhoto, InputDocument, InputChatPhoto and InputMedia. Their actual runtime
registries contain ten automatic input types; the preceding implementation
resolved the other six. The independent declarations and runtime now accept
reusable response photos/documents, messages containing those objects, uploaded
TL file handles, supported contact/location/venue/game/dice media and polls.

The schema selects the target type in scalar, vector, nested and generic request
fields. Conversion carries reference IDs, access hashes, file references and
supported message-media TTL fields. Existing input constructors retain identity;
nested response references resolve in place. A response source is canonicalized
and copied before conversion, leaving the original response unchanged. Common
request guards reject excessive depth, oversized vectors, cycles and malformed
method names before sending. Cancellation and selected-backend routing use the
existing request boundary. No upload or peer lookup is hidden inside a media cast.

The minimal example is a response Photo passed directly to SendMedia, or a
response Document passed to SaveGif. Before this change resolution leaves the
wrong TL constructor in the request. The frozen source reproduces 129 failures
among 143 new media tests. All 160 focused tests, including the existing peer
resolution tests, pass after conversion. The 106 SDK comparisons independently
serialize owned arguments, actual SDK helpers and actual request resolution; they compare constructor names
and bodies. They omit the four-byte constructor ID where optional schema layouts
changed between pinned SDK layers. Twenty filename cases additionally compare
uploaded-document metadata. Other cases verify native encrypted TCP delivery,
five selected adapter routes, binary references, source immutability, invalid
inputs, nested albums, pre-aborted requests and mutations during peer lookup.

Layer 232 needs a deliberate quiz difference. The official
[InputMediaPoll contract](https://core.telegram.org/constructor/inputMediaPoll)
defines correct answers as zero-based indices into the poll's answer vector.
Pinned teleproto returns byte options and serializes the selected `b` option as
integer zero in the reordered two-answer fixture; the owned implementation
selects index one. The official
[PollAnswer contract](https://core.telegram.org/constructor/pollAnswer) retains
MessageMedia in a response poll. Pinned teleproto mutates it into InputMedia,
producing a type mismatch when independently decoded. The owned conversion
preserves response answer media and converts the separate poll attachment and
solution-media fields. An ordinary poll retains exact current-SDK bytes.

The checked example [typed-media-casts.ts](../../../examples/typed-media-casts.ts)
passes with current declarations and produces five diagnostics with frozen
preceding declarations. The pinned SDK declarations omit response autocasts and
require their explicit utility helpers even though runtime request resolution
accepts them. `experiments/typed-media-sdk-differences.ts` checks both the expected
SDK declaration rejections and the explicit helper alternative with strict
library checking. Public shortcut unions identify source families; a constructor
must still contain the reference fields required by the runtime conversion.

Run the finite reproductions from a checkout containing the frozen commit:

```sh
node --loader ./experiments/media-casts-before-loader.mjs --test tests/account-media-casts.test.js tests/account-media-boundaries.test.js
node --test tests/account-media-casts.test.js tests/account-media-boundaries.test.js tests/api-resolution.test.js
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --media --before
GOMEMLIMIT=768MiB GOGC=50 node experiments/composer-fluency-check.mjs --media
GOMEMLIMIT=768MiB GOGC=50 node node_modules/typescript/bin/tsc --project experiments/tsconfig.media-sdk.json
node experiments/record-media-cast-facts.mjs
```

The runtime loader freezes only tl-resolution.js at
67f631532971f4d38adb265948960d2a8432fa57. The declaration runner freezes its API
classes and generated parameter types at the same commit. Tests and examples
remain identical. [The recorded inventory](data/media-casts.json) includes
installed source hashes, versions, primary references and every affected pinned
schema field. The implementations use shared owned schema data and conversion;
no third-party runtime implementation is copied into production.

Implicit filename inference covers 28 common extensions and uses a binary MIME
default for others. Explicit InputMedia preserves caller metadata and options.
Raw local paths and buffers require the existing uploadFile/prepareMedia APIs;
a TL InputFile already identifies an uploaded server file. Default SDK casts
also clear contact vCards and venue types and omit response spoiler/geolocation
accuracy metadata; these defaults are covered where applicable. Broad utility
option/MIME-database parity, richer custom models, complete application scenarios
and production Telegram interoperability remain open in the acceptance ledger.

All 2,408 core tests pass on Node, Bun and Deno. Strict lint, formatting,
declarations/examples, actual-SDK declarations and generation checks pass. The
duplication gate scans 169 production sources with zero clones; packaging has
212 permitted entries. The 27 native terminal, eight Node 20 vendor/terminal
wire and sixteen primary fact-parser checks pass, along with the bounded FIFO
cancellation probe. These are local finite checks; fresh exact-head CI and all
wider unfinished acceptance criteria remain tracked in the work plan.
