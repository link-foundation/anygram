# Account parser defaults and inheritance

Both account facades now use the independent legacy Markdown parser by default,
matching the pinned GramJS and teleproto constructors. Their bound messages use
the same setting for text reads/writes, replies and edits. File/album captions
share these defaults. Canonical methods retain plain text until explicitly
configured, including when the selected vendor has its own implicit parser.

Explicit parser configuration is shared by canonical methods, both facades and
bound views. Per-call `undefined` and `null` inherit the current setting;
`false` disables parsing for one call. Constructor `false` or `null` disables
globally; absent/undefined constructor settings preserve the facade default.
Calling `setParseMode(undefined)`, `setParseMode(null)` or `setParseMode(false)`
explicitly disables parsing. Property assignment has the same effect.

The previous WeakMap stored undefined for every constructor and could not
distinguish unconfigured clients from explicitly disabled clients. Backend scopes
copied only the getter value, losing that distinction. The shared settings helper
now retains presence and parser identity; copied scopes have independent later
configuration. Bound views read the facade setting instead of the canonical
plain default. Invalid configuration leaves existing state unchanged.

Explicit entities and `FormattedText` retain precedence. Empty per-item album
mode overrides inherit the top-level mode. Keyboard labels remain literal:
neither default nor configured custom parsers receive their contents. SDK-style
high-level-only backends receive the owned parser; canonical calls receive an
explicit disable so helper defaults cannot change interpretation.
Review reproduced two high-level-only canonical failures when a null per-call
mode still inherited the vendor parser; the boundary now normalizes both null
and undefined before invoking those helpers.

The [checked example](../../../examples/typed-account-defaults.ts) demonstrates
the distinction and scoped configuration. A [portable fixture](../../../experiments/typed-account-default-sdk-fixture.ts)
also compiles against the actual pinned SDK declarations. [Source facts](data/account-parser-defaults.json)
preserve installed source hashes and primary parser/entity documentation.

## Reproduction and verification

The initial 58-case corpus reproduced 46 failures. Review extended this to 146
finite cases; frozen preceding head `86d7685503f19e647bd13e9a880f99b1d0e39c88`
fails 96. Fifty guards already pass there, including global disable, pre-abort
and selected errors on existing paths; those are not claimed as missing behavior.

```sh
node --loader ./experiments/account-default-before-loader.mjs --test tests/account-parser-defaults*.test.js
node --test tests/account-parser-defaults*.test.js
```

Twenty-four comparisons use real SDK constructors and their own send, file,
album and replacement-edit helpers for default Markdown, explicit global disable
and configured HTML with null per-call inheritance. Complete request bytes match
through each SDK serializer. A separate current-schema translation also matches
native bytes. Two real SDK model comparisons check default and disabled reads
and writes. The older GramJS class patch loses its setter; the oracle invokes
its original CustomMessage setter directly, documenting that defect.

Four independent encrypted native TCP cases cover both styles with default and
disabled settings copied into backend scopes. Each checks history, send, file,
album, bound reply and replacement edit, preserving peer hashes and reply IDs.
All five selected routes check defaults and typed failures without replay. Exact
mention IDs above Number's safe range, cancellation before source consumption,
factory state and high-level-only helpers have finite regression coverage.

An initial cancellation assertion expected every abort to be wrapped; bound
helpers deliberately return the original reason before routing. The corrected
assertions accept that identity and retain no-request/no-consumption checks.
No cancellation implementation or timeout change was needed.

## Remaining scope

Canonical plain defaults are intentional. This finite comparison does not
establish complete SDK model or media-option compatibility, old-schema result
bridging, controlled-account production behavior or the wider feature-union
requirements. Those remain open; PR #2 stays draft and unmerged.
