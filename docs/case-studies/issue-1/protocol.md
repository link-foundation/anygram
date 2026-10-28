# Independent protocol implementation

The native implementation contains original public-domain code. Optional client
packages are development or consumer-supplied dependencies; they are excluded
from the published source package. Raw research snapshots retain their upstream
provenance and are excluded from publication by package.json's files allowlist.

## Sources and reproducibility

The registry is generated from Telegram Desktop's official API and MTProto TL
files at commit f985723b552b30fe1c17d377d57f44e61a15a8c4 (layer 232).
`src/schema/telegram.json` includes the immutable source URL.
`npm run schema:update` intentionally resolves the latest upstream dev commit;
review generated changes and update corpus expectations before committing.

The independent codec encodes required/optional fields, both flags words, true
flags, boxed and bare vectors, exact signed 64-bit integers, fixed-width
integers, bytes, strings and nested generic queries. Reads enforce byte, vector
and nesting limits, constructor types, required fields and complete consumption.
The corpus exercises all 869 registered methods and 1,758 non-boolean
constructors. Boolean constructors are exercised separately. A minimal fixture
per definition establishes serialization coverage, not server-side validity or
complete feature behavior.

`experiments/schema-corpus.mjs` compares bytes against pinned real teleproto
1.232.0 and GramJS 2.26.22 implementations. Definitions with mismatched root or
nested constructor IDs are excluded from that particular version's comparison;
they remain covered by native round trips. Current matches: teleproto 2,580,
GramJS 1,888. Tests also serialize mtcute requests through its actual writer,
including negative access hashes and values larger than JavaScript's safe range.
Mtcute peer IDs are limited by its own int53 schema; the adapter rejects unsafe
conversion instead of rounding. This comparison identified and fixed Uint8Array
conversion, fixed-width integer conversion and case-sensitive SRP field names.

## Transport and cryptography

`anygram/mtproto` exports Mtproto and HttpTransport. The default transport uses
Telegram's HTTPS binary endpoint, with an injectable transport for other network
environments. It implements RSA_PAD with pinned official production/test RSA
trust anchors, bounded 64-bit pq factorization, SHA-1 handshake hashes, safe-prime
and DH generator/public-value validation, AES-IGE and MTProto 2.0 key derivation.
Encrypted packets validate auth-key ID, message key, session, padding, body size,
server message parity, timestamp window and duplicate IDs before delivery.

Service handling supports RPC correlation, bounded containers and gzip, server
salt correction, session creation and acknowledgements. Acknowledgement failure
never converts an already completed send into an apparent send failure. Flood
waits and arbitrary server errors remain typed errors; application sends are not
silently replayed after an uncertain network failure. Request cancellation is
checked before transmitting queued work, and HTTP deadlines include body reads.

`tests/crypto.test.js` compares AES-IGE bytes with GramJS and verifies packet
integrity failures. `tests/mtproto.test.js` uses an encrypted in-process peer to
verify correlation, salt correction, replay filtering, cancellation, compression
limits and flood errors. Probes are finite and do not print credentials.

`node --max-old-space-size=128 experiments/mtproto-handshake.mjs` independently
completed an RSA/DH key exchange against Telegram's production DC2 endpoint on
2026-10-28. Telegram returned a valid encrypted CONNECTION_NOT_INITED RPC error
when the probe omitted an application API ID. This establishes live transport,
handshake and encrypted RPC error decoding. It does not establish account login,
message delivery or any other authenticated feature.

## Remaining acceptance work

Raw schema coverage does not establish complete Telegram protocol support.
Independent login/2FA, DC migration, durable sessions, ordered update recovery,
media transfer, secret-chat state and voice/video media need implementation and
scenario verification. The requirements ledger remains open for these criteria.
The HTTPS transport does not provide TCP, WebSocket, MTProxy or SOCKS support.
The unified TDLib adapter must preserve TDLib's separate JSON API; it must never
claim that an MTProto method string is a valid TDLib request.
