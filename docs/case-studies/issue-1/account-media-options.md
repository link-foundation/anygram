# Account media options and bounded uploads

Canonical sends, both account facades, albums, bound replies and replacement
edits now share media preparation. Named JPEG/PNG sources become photos;
other registered extensions supply MIME and document filename/audio/video
attributes. `forceDocument`, `asImage`, `mimeType` and explicit attributes retain
caller control. Raw TL InputFile shortcuts remain documents. Unknown or unnamed
bytes become documents unless explicitly selected as images. URL inference uses
the pathname, excluding query and fragment text.

The shared metadata path retains thumbnails, voice/round video, streaming,
spoilers, TTL, stickers, video covers/timestamps and current live-photo references.
Only fields supported by the selected media constructor are applied. False and
zero overrides remain explicit. Canonical snake-case flag aliases are accepted;
camel-case overrides win. References and supplied attribute bytes are detached,
with exact IDs retained. Album finalization copies reusable media flags rather
than discarding them after `messages.uploadMedia`.

All album items are preflighted before any source is consumed. Supplied metadata
must serialize through its proper TL family, with at most 1,000 attributes or
stickers and 256 KiB per supplied value. TTL/timestamps use nonnegative signed
32-bit values. Live-photo flags and video references must agree. The checks do
not open paths, read streams or perform RPCs.

Uploads accept the existing owned inputs, actual SDK CustomFile buffers/paths
and finite random-access sources. One to sixteen workers prepare ordered parts
before concurrent submission, retaining MD5 and continuous encrypted-file state.
The default remains one worker and a 64 MiB byte limit, including random-access
sources. A batch holds at most sixteen 512 KiB payloads. SDK `progressCallback`
receives fractions including initial zero; canonical `onProgress` receives bytes.
Both are awaited. Cancellation during reads, submission or progress stops later
batches and closes the source. Independent upload and close errors are retained.

See the [checked example](../../../examples/typed-account-media-options.ts) and
[actual-SDK declaration fixture](../../../experiments/typed-account-media-options-sdk-fixture.ts).
The [source inventory](data/account-media-options.json) records primary Telegram
constructors, installed SDK helper hashes and the MIME facts generator. Runtime
code has no MIME or SDK dependency; CI checks all 1,173 factual extensions against
the pinned development registry.

## Reproduction and comparisons

The initial 101 cases reproduced 97 failures before implementation. The final
153-case corpus fails 146 cases against frozen preceding source
`5ad1af7756479e63ab6162bacb9ee6de45d1e0ad`; seven existing/direct-helper guards pass.
The two exhaustive registry comparisons import the new helper directly and are
not claimed as frozen-source reproductions.

```sh
node --loader ./experiments/account-media-options-before-loader.mjs --test tests/account-media-options*.test.js tests/account-upload-controls.test.js
node --test tests/account-media-options*.test.js tests/account-upload-controls.test.js
node --max-old-space-size=64 --stack-size=512 experiments/account-upload-budget.mjs
```

Thirty-two comparisons invoke actual SDK file-to-media helpers and serialize
their output with the corresponding SDK. Two exhaustive comparisons cover all
1,173 registered extensions and complete inferred attribute bytes. Two actual
thumbnail uploads compare their part requests and result media. The pinned
GramJS helper supplies an empty checksum; the test independently verifies the
owned MD5 before normalizing only that known difference and random IDs.
Teleproto uses its real FileUploader with a finite local transfer manager.

Ten selected-route cases cover common metadata and typed errors on all five
backends, without fallback. Two independent encrypted TCP cases cover both
styles, thumbnails, albums and origin-bound replies/edits with exact peer hashes.
These local peers do not establish controlled-account production delivery.

Regression tests cover invalid later album entries, canonical aliases, live-photo
flag consistency, continuous encrypted uploads with concurrent parts, callback
cancellation, pending read/submission cancellation and independent cleanup errors.
Cancellation probes have finite fallback completions. An initial never-settled
read probe remained open and was terminated; it was replaced by the finite probe
before reproducing and fixing pending-read cancellation.
The resource probe reads seventeen half-MiB parts with sixteen workers under a
64 MiB heap and 512 KiB stack, without allocating the complete file; observed
maximum RSS is 113,912 KiB. A reused source-buffer regression fails with three
copies of the last part before detachment and passes with distinct payloads
and the checksum of the transmitted bytes afterward.

All 4,395 core tests pass on Node, Bun and Deno. The 153 focused cases also
pass on Node 20. Strict static/generation checks and actual SDK declarations
pass, with 196 production sources and zero clones. All 71 installed-framework
checks pass on Node 20/26, Bun and Deno; 27 terminal, eight Node 20 wire, sixteen
fact-parser and bounded FIFO checks pass. Packaging contains 241 permitted
entries. The first Bun run rejected a Node-only test-options signature; the
test now uses the portable harness. The actual SDK fixture uses legacy integer
constructors for exact cover IDs, matching its published declarations.

## Remaining scope

Explicit attributes supply actual duration/dimensions: neither pinned helper
parses binary metadata. Owned round-video inference avoids the pinned helpers'
accidental voice-audio attribute. MIME and photo defaults now follow the shared
high-level contract; unnamed image bytes require `asImage: true` or a filename.

Current flags on historical SDK schemas still require the older-schema bridge;
the five-route comparison covers fields supported by those SDK versions. Complete
SDK upload signatures, buffer-size/file-size hints, refined account models,
controlled-account delivery and every wider unfinished acceptance criterion remain
open. This work does not complete issue #1.
