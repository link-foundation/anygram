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

`anygram/mtproto` exports Mtproto, HttpTransport, TcpTransport, WebSocketTransport
and the transport framing classes.
The default transport uses Telegram's HTTPS binary endpoint, with native TCP
and injectable transports for other network
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
Independent login/2FA, DC migration, session storage, ordered update recovery and
media primitives have deterministic tests; complete application/live-account
scenarios remain unverified. Secret-chat state and voice/video media still need
implementation and verification. The requirements ledger stays open.
Fake TLS and obfuscated full framing remain unfinished.
The unified TDLib adapter must preserve TDLib's separate JSON API; it must never
claim that an MTProto method string is a valid TDLib request.

## Persistent TCP verification

Telegram's [framing specification](https://core.telegram.org/mtproto/mtproto-transports)
and [transport rules](https://core.telegram.org/mtproto/transports) were captured
in `data/telegram-transport-{framing,protocols}.md` on 2026-10-28.
The independent stream parser implements abridged, intermediate, padded and full
framing, size limits, CRC32/sequence validation, quick-ack separation and typed
transport errors. TCP tests fragment and coalesce packets, compare bytes with
actual GramJS encoders, exercise every padding length and bound pending queues.
Encrypted local-socket tests verify multi-packet RPC correlation and send-only
acknowledgements. Persistent update reads never send HTTP-only `http_wait`,
and an idle read timeout permits the recovery scheduler to tick again.

`node --max-old-space-size=128 experiments/tcp-handshake.mjs` completed a live
production DC2 key exchange over full TCP framing and decoded an encrypted
CONNECTION_NOT_INITED response on 2026-10-28. It prints no keys or sessions and
does not authenticate an account. Plain padded framing alone does not implement
obfuscation, MTProxy secrets or fake TLS. The local Node/Bun/Deno suites each
pass 133 tests. Deno grants network access only to 127.0.0.1 for local fixtures.

## SOCKS5 CONNECT verification

The connector independently implements [RFC 1928 CONNECT](https://www.rfc-editor.org/rfc/rfc1928.html)
and [RFC 1929 authentication](https://www.rfc-editor.org/rfc/rfc1929.html), with
proxy-side domain resolution, IPv4/IPv6 addresses and UTF-8 credentials. It
rejects authentication downgrade, invalid versions/address types, empty domain
replies and CONNECT failure codes before sending Telegram data. The TCP request
deadline includes negotiation; cancellation closes the negotiating socket.
This implements CONNECT with no authentication or username/password, without
claiming GSSAPI, BIND or UDP ASSOCIATE support. SOCKS4/4a is verified separately below.

The initial three regressions in `tests/socks5.test.js` failed because proxy
settings were ignored and the destination was resolved directly (ENOTFOUND).
The fixed tests use bounded real loopback sockets with fragmented responses,
credential rejection, malformed replies and coalesced tunnel bytes. All 137
tests now pass on Node, Bun and Deno; typed proxy construction compiles.

## Obfuscated TCP and MTProxy verification

`ObfuscatedFraming` follows Telegram's captured transport specification for
64-byte initialization, forbidden prefixes, independent continuous AES-256-CTR
directions and optional SHA-256 secret-derived keys. Initialization makes at
most 64 attempts. Native TCP supports direct obfuscation and MTProxy endpoints,
signed media/test DC routing and 16/17-byte secrets with validated hex/base64
encodings. Secret options and cipher objects remain private fields.

The initial four regressions failed with missing obfuscated framing and a
bounded TCP timeout. An additional regression showed that the obfuscation option
was ignored by the default HTTP selection. These now pass, alongside an explicit
error for an undiscriminated proxy secret. Tests compare actual GramJS headers
and three consecutive packets byte for byte, then verify both directions over
fragmented real loopback sockets. They exercise forbidden initialization
prefixes and invalid secret encodings. Fake TLS and obfuscated full framing
remain explicit unsupported modes.

`node --max-old-space-size=128 experiments/tcp-handshake.mjs padded --obfuscated`
completed a production DC2 authorization-key exchange and decoded an encrypted
CONNECTION_NOT_INITED RPC error on 2026-10-28. This verifies anonymous direct
obfuscated transport, without establishing authenticated account or public
MTProxy availability.

## WebSocket verification

The original implementation follows [RFC 6455](https://www.rfc-editor.org/rfc/rfc6455.html)
sections 4.1, 5.2–5.5 and 7, alongside Telegram's captured transport rules.
It uses Node-compatible HTTP/TLS primitives rather than a runtime WebSocket
global or external runtime dependency. The binary subprotocol, HTTP status,
upgrade headers and accept hash are validated; unsolicited extensions are
rejected. Client frames use fresh masks. Incremental reads support binary
continuations, interleaved ping/pong and bounded messages, frames and queues.
Invalid masking, RSV bits, opcodes, noncanonical lengths and close payloads
fail explicitly. Numeric Telegram close reasons preserve their error code.
The request deadline includes DNS, SOCKS, TLS and the HTTP upgrade.

The first five focused tests failed before the classes existed. Additional
regressions reproduced a TLS-close race that hid certificate errors and an
untyped invalid-UTF-8 close reason. The fixed suite checks fragmented real
sockets, cancellation, invalid upgrades and close messages. A pinned independent
`websocket` 1.0.35 development-only server verifies masks, large messages and
fragmentation without using Anygram's WebSocket parser. Loopback TLS tests check
default trust rejection, an explicit test CA and wrong-hostname rejection,
both directly and through a SOCKS5 tunnel. The public test certificate/key is
excluded from the published package.

`node --max-old-space-size=128 experiments/tcp-handshake.mjs intermediate --websocket`
completed an anonymous production DC2 key exchange and decoded an encrypted
CONNECTION_NOT_INITED RPC error on 2026-10-28. It prints no keys or sessions.
Node, Bun and Deno each pass 150 tests. This verifies the native network path;
browser/Worker runtime support and authenticated application scenarios remain open.

Both stream parsers share a bounded geometrically growing receive buffer rather
than concatenating the entire incomplete packet on every network chunk. Delivered
packets own their bytes. `tests/framing-resources.test.js` checks a finite copy
budget, compaction, caller mutation and storage reuse. Large empty buffers release
their allocations instead of retaining maximum capacity on idle connections.

## SOCKS4/4a CONNECT verification

The independent connector follows Ying-Da Lee's original
[SOCKS4 specification](https://www.openssh.org/txt/socks4.protocol) and
[SOCKS4a extension](https://www.openssh.org/txt/socks4a.protocol), captured in
`data/socks4.protocol` and `data/socks4a.protocol`. IPv4 CONNECT uses a bounded
NUL-terminated UTF-8 user ID; domain destinations use the 0.0.0.1 sentinel and
proxy-side IDNA DNS. IPv6, passwords and ambiguous reserved IPv4 destinations
are rejected before creating a socket. This implements CONNECT; BIND is not
part of this connector.

The initial three tests failed before implementation. Four regressions now
verify wire bytes, fragmented and coalesced replies, rejection codes 91–93,
invalid versions, bounded negotiation, unsupported settings and TLS-verified
obfuscated WebSocket traffic through a real loopback SOCKS4a tunnel. The TLS
server uses the independent WebSocket library. A malformed-domain test also
exposed Node domainToASCII truncating `bad/domain` to `bad`; both SOCKS versions
now reject invalid input before conversion can silently change its meaning.
All 160 tests pass on Node, Bun and Deno; strict lint, declaration and example
checks pass. Fake TLS, browser/Worker APIs and full protocol parity remain open.
