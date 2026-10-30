# Account file and album captions

Canonical sends, both account facades and bound file replies/edits share the
existing account parser and selected RPC path. Explicit HTML, Markdown,
MarkdownV2 and custom callbacks apply to file captions and every used album
caption. `sendMessage` with `file` sends media; edits with `file` include the
replacement media. Both account facades expose `sendFile` and `sendAlbum`.
The [checked example](../../../examples/typed-account-media.ts) and
[actual SDK fixture](../../../experiments/typed-account-media-sdk-fixture.ts)
compile against public declarations.

Scalar album captions belong to the first item. Caption arrays follow file
order; a single file uses the first caption in an array. `FormattedText` owns
its entities. Explicit `formattingEntities` or `entities`, including an empty
array, skip parsing. Global entities apply only to the first album caption;
per-item caption, entities and parse mode override inherited settings. Each
album item receives an independent random ID, retaining an explicit item ID.

Every used caption is parsed and validated before any upload source is
consumed. Mentions preserve exact user IDs and access hashes; failed mention
or destination resolution stops before upload. Both account facades retain
their loaded mention peers. Cancellation and selected-backend errors propagate
without replay through another backend. Shared schema casts accept reusable
SDK photos, documents, messages and other supported media constructors. The
backend receives detached reusable-media byte references.

## Reproduction and comparisons

The initial twenty-case suite reproduced eighteen failures. Further tests
reproduced dropped edit attachments, invalid entity ranges, unsupported SDK
constructors, `FormattedText` album routing, copied media references and
per-item precedence. The final 172-case suite fails 154 cases against immutable
preceding head `78df293f58eb148780f74570cee57bdebc23bfca`. Eighteen existing
guards already pass there: pre-abort, item random-ID/entity precedence and
selected failures or mention parsing on paths already implemented. They are
retained as regression guards rather than claimed as new missing behavior.
The preceding declarations produce ten diagnostics for missing facade helpers,
types, readonly arrays and unchecked options.

Review also reproduced eight failures when an explicitly undefined per-call
mode hid the configured parser on both account facades. The same shared settings
helper now preserves inheritance for text, file and album sends; those cases
remain part of the 172-case suite.

```sh
node --loader ./experiments/account-media-before-loader.mjs --test tests/account-media-formatting*.test.js
node --test tests/account-media-formatting*.test.js
node experiments/composer-fluency-check.mjs --account-media --before
node experiments/composer-fluency-check.mjs --account-media
node --max-old-space-size=192 --stack-size=512 experiments/account-media-bounds.mjs
```

Fifteen real SDK comparisons cover single files, albums and replacement-media
edits across HTML/legacy Markdown for both SDKs and MarkdownV2 for current
teleproto. Complete bytes match when owned requests use the corresponding SDK
serializer. Native bytes match current teleproto exactly. GramJS layer 181
also changes nested media/reply IDs, so its old argument bytes cannot be
compared merely by excluding the method ID. A separate current-schema
translation of its independently generated request matches native bytes.
The older-schema runtime bridge remains unfinished.

Seventy-eight reusable-media comparisons cover 26 source forms through owned,
GramJS and teleproto constructors against actual SDK cast bytes. All five
selected routes preserve parsed captions and submission failures. Three
independent encrypted native TCP cases each check history, single-file send,
album, bound file reply and bound replacement-file edit. They preserve source
hashes, reply/message IDs, caption entities and reusable media bytes.

The finite helper probe validates ten captions at the 4 Mi code-unit bound and
rejects excess text, caption count and entity count under a 192 MiB heap and
512 KiB stack. It establishes those finite local resource guards, rather than
Telegram's server-side caption acceptance. Albums accept two to ten files;
each caption permits at most 1,000 entities. Existing bounded parser limits
remain in force.

## Differences and unfinished scope

Both pinned SDK album helpers ignore `formattingEntities`. The owned explicit
first-caption/per-item contract preserves caller intent. Per-item options and
`FormattedText` are extensions; SDK file arrays use raw files and string
captions. Invalid later captions and replacement-file formatting are checked
before consuming uploads; pinned edit helpers prepare media before parsing.

The [facts inventory](data/account-media-formatting.json) preserves actual SDK
source hashes, primary method references and regression commands. This work
verifies explicit parsing and reusable media. The [default-formatting follow-up](account-parser-defaults.md)
adds SDK defaults and explicit disable persistence. Complete file
inference/flags/thumbnails/upload-option parity, older-schema
result bridges, controlled-account scenarios and all wider acceptance criteria
remain unfinished. The pull request remains draft and unmerged.
