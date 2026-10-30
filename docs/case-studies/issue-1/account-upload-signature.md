# Account direct-upload signatures and source bounds

Both account facades accept `uploadFile({ file, workers, onProgress,
maxBufferSize })` and return owned `Api.InputFile`/`Api.InputFileBig` views with
native class guards and complete serialized bytes. Actual SDK `CustomFile`
records remain accepted. The root `CustomFile` export supplies the same four
metadata fields without requiring a vendor dependency. It validates its size,
path and optional buffer; it is intended for Anygram operations. Foreign SDK
helpers can require their own nominal `CustomFile` class.

Direct SDK-style `onProgress` receives fractions including zero. Canonical
`uploadFile(source, options)` retains its byte-count callback. The canonical
entry also accepts the SDK wrapper, with its fractional callback contract.
Shared workers, cancellation and progress await behavior apply to both. Selected
clients with raw invocation use the shared operation; high-level-only upload
backends retain their existing route.

`fileSize` is an optional exact expected size, checked before upload progress or
RPC. Album preflight catches known later-item mismatches before any earlier
source is consumed. Thumbnail uploads do not inherit the main file's size.
`maxBufferSize` bounds whole-source buffering for streams and HTTP inputs.
Zero forbids this fallback while allowing resident bytes, random-access records,
local paths and sliced Blobs. Unlike the pinned SDKs' threshold option, paths
always use bounded random-access reads. All inputs retain the existing 64 MiB
default byte limit and finite part/worker limits; callers can select a larger
explicit byte budget.

InputFile suppliers resolve once, retaining single-use/reusable behavior. Local
paths, file URLs, buffers, Blobs and random-access records stay lazy. Explicit
deadlines cover acquisition, reads, RPC and progress; late-opened owned handles
are closed. The previous default deadline for InputFile remains in place.

## Reproduction and evidence

The [source inventory](data/account-upload-signature.json) pins both installed
SDK implementations and declarations, plus the official upload and result
contracts. The [portable example](../../../examples/typed-account-upload.ts)
and [actual SDK fixture](../../../experiments/typed-account-upload-sdk-fixture.ts)
verify callback and result types with strict negative assertions.

```sh
node --loader ./experiments/account-upload-signature-before-loader.mjs --test tests/account-upload-signature.test.js
GOMEMLIMIT=768MiB GOGC=50 node experiments/account-upload-types-before.mjs
node --test tests/account-upload-signature.test.js tests/account-media-options*.test.js tests/account-upload-controls.test.js
node --max-old-space-size=64 --stack-size=512 experiments/input-file-blocked-path.mjs account
node --max-old-space-size=64 --stack-size=512 experiments/input-file-blocked-path.mjs account-input
node --max-old-space-size=64 --stack-size=512 experiments/account-upload-path-budget.mjs
```

Two comparisons execute actual SDK uploads, matching complete part-request and
result bytes after normalizing random IDs. The pinned GramJS helper leaves MD5
empty; the owned checksum is independently verified before this documented
normalization. A separate comparison reproduces GramJS rejecting a buffer-only
CustomFile above its buffering threshold, then verifies the resident-buffer
upload succeeds through Anygram. Teleproto already preserves that buffer.

All 59 focused cases pass on Node 20/26, Bun and Deno; the frozen preceding
source fails 53 and retains six existing guards. The preceding declaration
snapshot produces three diagnostics. The 212 affected cases pass together.
The finite file probe also reproduced an empty supplier filename; a minimal
path-supplier regression verifies the resolved name after the fallback fix.

Ten selected routes and two independent encrypted TCP cases cover both styles.
Finite cancellation cases cover acquisition and pending reads. The Linux FIFO
probes release a blocked open after 250 ms and verify no retained descriptor;
they have a five-second watchdog. The sparse-file probe uploads exactly 48 MiB
in 96 parts with sixteen workers under a 64 MiB heap and 512 KiB stack. Maximum
RSS is an observation, not a portable allocation guarantee.
The recorded sparse-file run reached 132,868 KiB maximum RSS.

## Remaining scope

Current flags on historical SDK schemas still require connection layer
negotiation and a schema bridge. Refined account results, drafts, array totals,
legacy integer methods, controlled-account delivery and every wider unfinished
acceptance criterion remain open. This change does not complete issue #1.
