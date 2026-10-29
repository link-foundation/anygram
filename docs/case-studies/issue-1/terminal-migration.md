# Executing the pinned terminal applications

The complete text and visual bot sources at
`konard/telegram-terminal-bot@7f3aeee50965160b31dca62b6e5b4e4a7af99bea`
now execute through the shared bot runner in bounded application scenarios.
The loader verifies source byte counts and SHA-256 before selecting application
handlers. Default scenarios exclude imports and logger/environment startup and
control PTYs, timers, process signals and rendering. Separate startup scenarios
execute the actual polling runner against a controlled fetch transport; a separate
Node/Linux integration command uses actual PTYs, canvas and GIF encoding.
Six further native scenarios execute every startup statement from `config()`
through polling with actual dotenv 16.4.5, pino 8.19.0 and file streams. Only
import bindings, the process facade, fixture paths and Telegram transport are
injected. Configuration is read into an isolated environment from temporary
`.env` files. Valid startup calls getMe once and begins one controlled poll;
missing token/authorization stops before Bot construction and emits a fatal log.
The text application uses the complete actual pinned virtual terminal emulator.
No test opens a shell, contacts Telegram or uses account credentials.

The explicit migration is in `examples/terminal-migration.js`. Its complete
[derived patch](terminal-migration.patch) applies to both original files, with
an automated `git apply --check` regression. Regenerate it using
`node experiments/render-terminal-migration.mjs`. The emitter writes source
artifacts under ci-logs and never executes them. The patch changes:

- The Bot import to anygram and the unused InlineKeyboard import removal.
- General text registration to follow command registration, allowing help,
  stop and restart to run. The synthetic restart update gains a command entity.
- Timer/subscription cleanup and terminal identity guards, preventing a retired
  PTY from editing or deleting a replacement session. Stop and both process
  signals clean pending application timers and terminal state.
- Visual output retention to a 256 KiB suffix and copying current output into
  session state, so captured animation frames contain the actual recent output.

These are application defects present with actual grammY too, rather than
framework behavior that should be reproduced by the shared runner. Nine of the
initial fifteen scenarios fail without the patches. The remaining paths and
actual grammY comparisons preserve previously working behavior. Sixteen current
scenarios cover ID/username authorization, all aspect presets, invalid input,
backtick parsing, control bytes, help/stop/restart, retired/natural PTY exits,
text edits, unchanged-message handling, replacement after 400 errors, timers,
subscriptions, both signals and animation submission. Reference/native command
effects match using the actual installed grammY middleware and API conversion.

Animation submission exposed a separate transport defect: `{ source: Buffer }`
was serialized as a JSON object containing an attachment reference. The Bot API
requires the animation field itself to contain that reference. The shared
multipart visitor now recognizes buffered/Blob `source` wrappers alongside
existing bytes, Blobs and `data` wrappers, including nested media/thumbnails.
It preserves filenames, caller data and exact bytes. The same value mapper used
for TL normalization guards depth and vector size before visiting entries.
Upload preparation checks pre-cancellation, caps total bytes at 64 MiB by default
(`maxUploadBytes`) and accepts at most 1000 attached files per request. Invalid
limits and oversized uploads fail before fetch; no operation is replayed.
Six separate upload regressions all fail before implementation.

The default controlled renderer records four frames and supplies synthetic GIF
bytes. The isolated native integration additionally uses actual canvas 3.1.2,
gifencoder 2.0.1 and node-pty 1.1.0, with omggif 1.0.10 independently decoding
uploaded bytes. All four frames are 537 by 614 pixels, with a one-second delay
and looping enabled. The original source produces zero foreground pixels;
the migrated source produces 1077 in each locally rendered frame. Exact hashes
and sizes are in `docs/screenshots/terminal-rendering.json`.

Before (original source):

![Blank original animation frame](../../screenshots/terminal-before.png)

After (explicit migration):

![Actual migrated terminal rendering](../../screenshots/terminal-after.png)

Both complete GIFs are adjacent to these PNGs. Regenerate with
`node experiments/terminal-runtime/render-evidence.mjs` after
`npm ci --prefix experiments/terminal-runtime`. The separate command
`npm test --prefix experiments/terminal-runtime` checks independent GIF decoding
and both application modes through real PTY children. Each child has a 64 MiB
JavaScript heap, a fixed three-second lifetime and finite output; no user shell
or account is opened. Its dedicated Ubuntu/Node CI job gates release. Native
fixture dependencies remain isolated from the published dependency-free package.

Three additional failing-before regressions exercise both signals while an
actual owned polling request drains and during active animation capture.
Both signals share one shutdown task; it stops polling, closes terminal state,
cancels every owned frame/wait timer, settles the animation handler, awaits
polling and accepted handlers, and only then exits once. No cancelled animation
is submitted. The full derived patch retains these explicit application fixes.

A fourth failing-before shutdown regression catches successful exit before log
writes finish. The patch creates the logs directory and keeps its destination
stream, then awaits that stream after polling and handler drain. Full-startup
checks verify its real final log record before successful exit and stream close.
The invalid-configuration checks explicitly flush their fixture streams after
catching exit; they do not establish fatal-exit flushing in a real process.

The visual source advertises static PNGs in help but implements regular-command text edits;
there is no static-photo handler to claim as covered. InlineKeyboard is unused
in these pinned sources. Full keyboard/photo scenarios, fatal-exit logging/error recovery, native
rendering on other runtimes/platforms and controlled-account delivery remain
open. Polling shutdown is verified with the actual runner and a controlled
transport; authenticated online delivery is still unverified. This advances R05/R08/R13/R16/R19;
it does not close R13 or the broader feature-union criteria.

All 614 tests pass on Node, Bun and Deno. Strict ESLint, formatting, full
TypeScript declarations/examples and the duplication gate pass with zero clones
across 78 production sources. The package dry run contains 121 permitted entries.
The earlier 610-test head 5a232706 passed all nine runtime/OS jobs and applicable
gates in [run 40847213870](https://github.com/link-foundation/anygram/actions/runs/40847213870),
created 2026-10-29T09:07:50Z and completed 2026-10-29T09:10:19Z. Rendering/shutdown head 2b8ef53f passed all nine runtime/OS jobs, the native
integration job and applicable gates in
[run 40848702436](https://github.com/link-foundation/anygram/actions/runs/40848702436),
created 2026-10-29T09:19:14Z and completed 2026-10-29T09:22:16Z. Fresh matrix
CI is required for the complete startup and log-drain checkpoint. Its local
isolated integration command passes nine cases.
