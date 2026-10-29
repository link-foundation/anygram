---
'anygram': minor
---

Introduce shared Telegram backend routing and optional client adapters alongside
schema-aware native request peer/message shortcuts, recursive resolution through
the selected backend, checked shortcut declarations and cancellation/depth guards,
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
Track secret-chat layer notifications and sequence-based modern-envelope
cutovers, preserving initial negotiation races and rejecting late downgrades.
Prepare initial secret-chat request/accept RPCs with protected recoverable state,
participant/key validation and mandatory persistence before sending or exposing
ready credentials. Discard invalid exchanges and preserve independent failures.
Add shared invite-membership inspection and bounded follow-group workflows,
including exact peer matching, notification settings and archival. Own account
connections through application work and bounded disconnect/destroy cleanup,
retaining all exhausted cleanup causes alongside the original failure.
Normalize GramJS/teleproto protocol class aliases and fixed-width big integers
through the shared request path; compare compatible schema layouts in both
directions against independent serializers.
Add shared GramJS/teleproto-style account data views, including camelCase TL
objects, exact marked dialog IDs, peer-qualified top messages and bounded
pagination, without requiring vendor model classes on native backends.
Add schema-backed native API class constructors and generated declarations,
retaining numeric random IDs and converting owned requests into vendor runtime
classes through the shared adapter path. Bound atomic file reads/writes and
follow session imports while preserving prior files on validation failure.

Apply shared request depth/vector guards before canonical and vendor conversion,
including configured native codec limits before queued RPC work.
Return shared camelCase data from GramJS-style invocation/send facades and apply
the same normalization depth/vector guards to complete response values.
Allow awaited nested bot updates without deadlocking the outer queue, deduplicate
active ancestor IDs and bound nesting. Share active session transactions across
nested contexts while preserving replacement, deletion and failure persistence.

Preserve grammY chat/inline edit signatures and Telegraf's separate positional
view over one transport. Retain structured Bot API failure data for application
recovery, copying parameters and redacting native response descriptions.

Accept buffered and Blob source wrappers in Bot API multipart media, preserving
filenames and guarding total bytes, file count, nesting and vector lengths.

Add explicit native Bot API InputFile paths, URLs, byte iterators, Node/web
streams and reusable suppliers. Share bounded file/HTTP readers and cancellation,
start request deadlines before upload preparation, close rejected/late sources,
and retain plain file IDs and Passport error JSON fields.

Convert owned file sources through selected grammY, Telegraf and current
node-telegram-bot-api clients with one shared bounded reader and request scope.
Preserve vendor file instances and support legacy multipart formData contracts.

Share explicit InputFile source preparation with account cloud and encrypted
uploads, including part-capacity/byte limits, cancellation, source cleanup and
selected-backend serializers. Preserve legacy random-access upload behavior.

Share canonical bot identity, send, edit, delete, forward and document operations
across all four bot transports. Separate cancellation/deadline controls from
payload fields, preserve explicit object-message options, and retain grammY's
zero-payload raw method signatures.

Add a complete community-posting application example over selected bot and
account transports, with durable scoped prompts, rate limits, publication
reconciliation and publish-before-delete lifting. Own CLI polling, account
connections and shutdown through cancellation and bounded local persistence.

Preserve positional and context cancellation signals, separate embedded bot
request controls through the shared translator, and retain raw Telegram timeout
fields and explicit message deletion across bot framework views.

Route event listener failures through the shared update recovery boundary and
preserve Telegraf's original-error/context callback contract. Await recovery
before acknowledging updates, retaining failures and queue ownership.

Map all 198 public helpers from the pinned grammY API through one shared
positional translator, preserving raw-object compatibility, aliases, inline
routes, rich-message branches, poll normalization and request controls. Check
regenerated method facts and declarations against actual SDK comparisons.

Share all six query registration shortcuts and asynchronous scoped filters,
preserving actual grammY string/regular-expression match values, trigger-array
snapshots and query context aliases across selected bot transports.

Prevent JSON serialization from issuing synthetic toJSON requests through raw
account or bot method proxies, while preserving explicit RPC invocation.

Map all 125 public pinned Telegraf API members through shared selected-backend
operations, retaining aliases, ordered options, formatted text and defaults.
Add canonical file URLs with private server/token configuration, explicit custom
file roots and metadata lookup through the selected backend. Preserve embedded
request controls when a final options object supplies undefined controls.

Share complete pinned context update aliases and aggregate source resolution,
preserving grammY/Telegraf precedence, business/reaction identifiers and detached
Telegraf message helpers without changing incoming updates.

Add the pinned context chat delivery shortcuts and aliases, preserving business,
forum and direct-message scope, caller overrides, SDK-specific dice/invoice
signatures, draft identifiers, checklist scope errors and request controls through
the shared positional APIs. Keep concrete context types in middleware and scenes.

Bind pinned chat administration, author and forum context helpers through the
shared positional APIs. Preserve business pin defaults, SDK-specific moderation
arguments, topic sources, scope errors, dynamic aliases and cancellation, with
checked declarations derived from the regenerated API argument tuples.
