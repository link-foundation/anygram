# Explicit Bot API file inputs

The native Bot API transport previously accepted only bytes, Blobs and buffered
wrappers. Paths, streams and supplier functions were serialized as objects or
failed before a valid attachment reached Telegram. `tests/input-file.test.js`
retains twenty scenarios: ten initial failures, one existing structural guard,
six further contract checks and three additional failing-before resource probes.

The owned `InputFile` constructor follows grammY's explicit upload convention.
It accepts bytes, Blobs, local paths, file/HTTP/HTTPS URL objects, URL-like
objects, synchronous/asynchronous byte iterators, Node readable streams, web
streams and suppliers. Plain Bot API strings retain their remote-ID/URL meaning.
Telegraf-style `{ source, filename }` wrappers accept these sources too. Wrapper
recognition excludes Passport error records with their unrelated `source` field.

The shared multipart collector validates the complete request structure before
invoking a supplier or opening a file. It consumes files sequentially, retains
filenames, MIME types and nested attachment references, and bounds aggregate
attachment bytes with `maxUploadBytes` (64 MiB by default) and file count (1000).
Source unwrapping permits sixteen steps; iterator/body reading permits at most
100000 reads. Empty chunks do not consume retained-array space. Chunk snapshots
prevent later producer mutations from corrupting previously read bytes.

The existing local-file source reader owns file handles; validation/read failures
and successful completion close them. The existing HTTP response reader handles
web streams and downloaded URL bodies. It now rejects non-byte chunks, bounds
read count and snapshots chunks. Both readers release or cancel their owned
resources. HTTP source downloads use the configured fetch function with the
request signal, without Bot API authorization headers or token-bearing URLs.

Request deadlines now start before preparation and cover suppliers, stream reads,
downloads and the Bot API request/response. A shared cancellation helper also
replaces the earlier TCP-only helper. Cancellation stops awaiting blocked user
iterators and requests their return; Node streams are destroyed. A supplier
result that arrives after cancellation is discarded through its supported close
operation. A late URL response body is cancelled too. A bounded Linux FIFO
probe reproduces a blocked local-file open: cancellation returns before a writer
unblocks the open, and the eventual handle is closed. Kernel filesystem calls
continue until they complete; cancellation stops awaiting them and retains
cleanup ownership. Arbitrary application suppliers/iterators must cooperate with cleanup;
the library cannot terminate code executing outside its owned resources.
Direct stream-backed InputFile instances are single-use. Bytes, Blobs, paths,
URLs and suppliers are reusable; a supplier can create a fresh stream per send.
Preparation preserves caller cancellation reasons and source errors; network
failures at the Bot API transport retain credential redaction.

Reproduce with `node --test tests/input-file.test.js tests/bot-upload.test.js
 tests/bot-api.test.js` (on one line). The same focused cases pass on Bun and
Deno. Filename and buffer data are compared with actual pinned grammY InputFile.
The typed usage example is `examples/typed-bot-uploads.ts`. No account or external
network is used by these tests. A finite empty-chunk probe catches unbounded
stream bookkeeping; a late-supplier probe catches an undestroyed Node stream.

This advances R05/R08/R13/R16/R19. It covers native BotApi and owned bot facades.
[Optional vendor conversion](vendor-bot-uploads.md) now has a separate checkpoint.
Account-media InputFile integration, streaming multipart without buffering and
complete browser/Worker parity remain open. It does not establish the complete
file/media feature union or downstream keyboard/photo coverage.

All 634 tests pass on Node, Bun and Deno; the thirteen isolated native terminal
integrations still pass. Strict ESLint, Prettier, TypeScript/example compilation
and schema declaration freshness pass. The duplication gate scans 81 production
sources with zero clones. The package contains 124 permitted entries. Fresh CI
is required for the late-source cleanup change. The preceding file-input head
9aa73176 passed all nine runtime/OS jobs, native integration and applicable gates
in [run 40852795814](https://github.com/link-foundation/anygram/actions/runs/40852795814),
created 2026-10-29T09:50:35Z and completed 2026-10-29T09:52:30Z.

The late URL-response regression failed with zero body cancellations before its
fix. Run the separate filesystem probe with
`node --max-old-space-size=64 --stack-size=512 experiments/input-file-blocked-path.mjs`.
It failed before the change because cancellation waited for the delayed writer
(about 254 ms). It now asserts event ordering and eventual descriptor cleanup,
with a finite writer retry count and five-second process watchdog. It runs in
the Linux native integration CI job; it is separate from the portable test count.
