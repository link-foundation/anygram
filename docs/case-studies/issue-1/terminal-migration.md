# Executing the pinned terminal applications

The complete text and visual bot sources at
`konard/telegram-terminal-bot@7f3aeee50965160b31dca62b6e5b4e4a7af99bea`
now execute through the shared bot runner in bounded application scenarios.
The loader verifies source byte counts and SHA-256 before selecting application
handlers. It excludes imports, logger/environment startup and real polling;
PTYs, timers, process signals and the GIF/canvas implementation are controlled.
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

The controlled renderer records four captured frames and supplies a finite
synthetic GIF byte sequence; this verifies frame data and multipart submission,
not actual canvas pixels, GIF interoperability or Telegram delivery. The visual
source advertises static PNGs in help but implements regular-command text edits;
there is no static-photo handler to claim as covered. InlineKeyboard is unused
in these pinned sources. Full keyboard/photo scenarios, actual rendering/PTY
integration, logger/startup behavior, awaited online polling shutdown and
controlled-account delivery remain open. This advances R05/R08/R13/R16/R19;
it does not close R13 or the broader feature-union criteria.

All 610 tests pass on Node, Bun and Deno. Strict ESLint, formatting, full
TypeScript declarations/examples and the duplication gate pass with zero clones
across 78 production sources. The package dry run contains 121 permitted entries.
Fresh matrix CI is required for this checkpoint.
