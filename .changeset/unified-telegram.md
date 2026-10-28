---
'anygram': minor
---

Introduce shared Telegram backend routing and optional client adapters alongside
independent Bot API and encrypted MTProto transports. Add layer-232 TL support,
account/QR/2FA authentication, portable sessions and storage, DC migration,
ordered update recovery, bounded watched-channel scheduling, media upload/albums
and message-origin downloads, peer/contact helpers, bot middleware/events,
polling ownership and formatted runtime templates. Bound HTTP response bodies,
release readers, and enforce cancellation and per-request deadlines. Preserve
exact IDs and expose typed failures without retrying ambiguous side effects.
