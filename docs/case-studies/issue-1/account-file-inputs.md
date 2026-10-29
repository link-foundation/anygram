# Shared file inputs for account uploads

The Bot API's owned `InputFile` could not be used with account uploads. The
existing account source selector rejected it, despite mentioning InputFile in
its error. GramJS and teleproto adapters instead passed it to incompatible
vendor helpers. Before implementation, nine new account cases and the changed
bilateral secret-file TCP scenario all failed. Those failures are preserved in
the local `ci-logs/account-input-before.log` investigation log. Two further
failing-before deadline probes showed that preparation ignored `timeout` until
the finite 500 ms watchdog aborted it (`account-input-timeout-before.log`).

The shared source selector now prepares explicit owned inputs through the same
bounded reader used by Bot API uploads. Part settings are validated before
invoking a supplier. The default preparation limit is 64 MiB, capped further by
the configured part size and count. Byte overflow closes an iterator before any
RPC. An owned upload has a 30-second default deadline, shared across preparation,
RPCs and progress callbacks; `timeout` overrides it. Cancellation preserves its
original cause, rejects a blocked supplier and cleans a supported source that
arrives later. A reusable supplier is reopened;
a direct stream remains single-use. File names survive unless explicitly
overridden in upload options. URL downloads use the supplied fetch and signal.

Cloud uploads, albums and encrypted files share this preparation. Encryption
still uses independent one-time keys, continuous AES-IGE and ciphertext checksums.
Legacy direct bytes, Blobs and local paths retain their existing random-access
behavior rather than inheriting the new buffer limit. A separate local-file
source module serves both readers without a module dependency cycle.

Owned files select shared account operations through the chosen raw backend.
The optional client still serializes and sends the RPC; another backend is not
selected for retry. Ordinary vendor upload inputs retain their existing route.
`tests/account-input-file.test.js` has nineteen portable cases, including:

- Reusable suppliers, exact part lengths, checksums and filename overrides.
- Byte and part capacity rejection before sending, invalid settings before
  opening, late-source cleanup and direct-stream reuse rejection. Six more cases
  cover cloud/encrypted deadlines during blocked preparation, RPC and progress.
- Paths, file URLs, Blobs, web streams and explicit downloaded URLs.
- Actual GramJS and teleproto binary serialization for uploads and mixed albums.
- Actual mtcute writer serialization, independently decoded by the native codec.
- Native encrypted TCP cloud upload without serializing the source wrapper.

`tests/secret-files-integration.test.js` additionally starts with a supplied owned
InputFile and verifies encrypted upload, delivery, download and forwarding through
two native peers before qts acknowledgement. The typed upload example compiles
both cloud and encrypted owned inputs. Run focused verification with:

```sh
node --test tests/account-input-file.test.js tests/secret-files-integration.test.js
```

This is bounded preparation before account upload, not unbuffered source upload.
Local peers do not establish production interoperability. Full input-media
autocasting, broader competitor feature union, downstream scenarios and runtime
criteria remain open. The optional Telegraf encoder's newer-runtime failure is
tracked separately in [vendor upload evidence](vendor-bot-uploads.md).
