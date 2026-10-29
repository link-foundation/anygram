# Native class constructors

The original follow application passes an `Api` namespace into callbacks, while
the native bridge previously supplied none. Seven failing-before tests are
preserved in `ci-logs/api-classes-before.log`. The shared native namespace now
contains all 2629 definitions in the pinned layer-232 registry: 869 methods and
1760 constructors, including MTProto service definitions. It reuses the existing
TL serializer, field normalization, fixed-integer conversion and random-ID
generator. CRC32 is shared with transport framing rather than reimplemented.

Constructors expose camelCase fields, original arguments, class name/type and
constructor/result-type IDs. Fields remain mutable; `getBytes` serializes their
current values. Missing numeric random IDs are generated once, including one
per message in a forwarding vector. Explicit zero IDs survive. Byte-valued IDs
remain required. Owned native instances are tracked weakly and reconstructed
with each vendor's actual runtime classes; their serializer alone is not enough
to supply vendor request resolution and result readers. Existing vendor request
instances retain their identity.

Ten regressions check every metadata entry; 2627 finite serialization fixtures
(excluding the two primitive Bool cases), including comparisons against 2623
teleproto and 1931 GramJS layouts; mutation, flags and fixed integers; actual
vendor request identity/prototypes; mtcute and mtproto conversion; and original
follow callbacks through encrypted native TCP. Native and direct follow bridges
now default to the shared namespace; explicitly selected vendor namespaces remain
available. TypeScript examples include expected failures for misspelled members,
missing arguments, wrong TL peer types and invalid primitive fields.

`npm run schema:types` generates declarations in files below 1500 lines. The
standard typecheck also verifies exact regeneration, including CI. Generated
schema declaration bodies are excluded from clone detection as data; all
handwritten production code remains in its existing scan. The 38 generated
declaration files are compiled and checked for freshness separately.

These constructors require fully specified TL objects. String/input-peer
resolution, vendor reader/custom model methods, full return/event compatibility
and controlled-account application evidence remain open. The namespace alone
does not satisfy complete backend or protocol parity.

# Windows CI fixture correction

Constructor run 40834951184 (head 527b7cd) passed six Linux/macOS runtime jobs and
static/release gates but failed all three Windows runtimes. Preserved full logs
identify `Missing expected rejection` at `tests/follow-environment.test.js:137`:
Node log lines 14227–14244, Deno 8832–8841 and Bun 17791–17807. Storage run
40835990563 (head 2514dbc) reproduced exactly the same failure, at Node log lines
9705–9726, Deno 13460–13469 and Bun 16855–16875. The store correctly treats
`ENOENT` as an absent file. Windows reports that code for a child of a regular
file, while Unix reports `ENOTDIR`. The read-failure fixture now targets an
existing directory consistently on all platforms; the blocked writer and queue
recovery assertions remain. Fresh matrix CI must verify this correction.

## Local validation

Node, Bun and Deno each pass all 524 tests. Strict ESLint, formatting, declaration
compilation and exact regeneration pass. The repaired duplication gate scans
76 production sources with zero clones; the 38 generated declaration data files
are excluded explicitly and compiled separately. The package dry run contains
119 permitted entries. Logs are retained under `ci-logs/api-*`; fresh matrix CI
is required for this checkpoint.
