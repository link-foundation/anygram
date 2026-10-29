---
'anygram': minor
---

Introduce shared Telegram backend routing and optional client adapters alongside
independent Bot API and encrypted MTProto HTTPS/TCP transports. Add four native
TCP framing formats with bounded streams and send-only acknowledgements,
SOCKS4/4a and SOCKS5 CONNECT with proxy-side DNS, IPv4/IPv6 and optional authentication,
continuous AES-CTR obfuscation and MTProxy secret/DC routing, binary WebSocket
transport with TLS validation, masked frames and bounded fragmented streams,
layer-232 TL support,
account/QR/email/2FA authentication, portable sessions and storage, DC migration,
ordered update recovery, bounded watched-channel scheduling, media upload/albums
and message-origin downloads, peer/contact helpers, bot middleware/events,
polling ownership, formatted runtime templates and shared bot session middleware
with grammY/Telegraf storage semantics. Share nested composers, persistent
scenes/wizards and Telegraf command/launch dispatch. Bound HTTP response bodies,
release readers, enforce cancellation and per-request deadlines, and await
all DC transport closures while retaining cleanup failures. Use shared receive
buffers to bound assembly copies for fragmented TCP/WebSocket streams. Preserve
exact IDs and expose typed failures without retrying ambiguous side effects.
Drain accepted updates and persisted cursors before stopping recovery, preserve
independent failures, and bound pending session notifications and handler errors.
Add bounded MTProto 2.0 secret-chat envelope encryption/decryption with explicit
originator direction, integrity/padding checks and owned-key destruction.
Add the independently versioned secret-chat TL codec, preserve historical
constructor IDs and retain flag-only fields from the primary TL text.
Track secret-chat sequence parity, ordered acknowledgements, duplicate/gap
recovery and exact cached retransmissions with bounded private state. Validate
portable snapshots and recover unsent messages and active gaps after restart.
Copy decoded TL byte/fixed-integer fields independently of Buffer input storage.
Replace deleted unacknowledged secret messages with self-deletion services and
create follow-up deletions, reserving bounded cache capacity before mutation.
Generate recoverable secret-chat DH exchanges with refreshed configuration,
bounded safe-prime validation caching, local entropy, public-value bounds,
fingerprint verification and owned private-exponent destruction.
Upgrade outgoing secret-chat layers while preserving historical cached bytes,
headers and deletion serialization through retransmission and restart.
Support explicitly selected legacy secret-chat envelopes for initial layer
negotiation, retaining MTProto 2.0 as the default without automatic fallback.
