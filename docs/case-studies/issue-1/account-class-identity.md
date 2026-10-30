# Account API class guards

Shared account views now support `instanceof Api.Message`, `Api.User` and every
other known schema class exported by Anygram. Nested peers, media and request
views retain the same identity. Both account styles use this implementation on
all selected backends, including independently decoded native TCP results.

The preceding conversion copied camel-case fields into plain objects. Native
classes already existed, but their ordinary prototype checks could not recognize
those views. Bound messages also require their existing helper prototype, so
replacing the prototype would remove useful behavior. A private weak identity
map and the standard `Symbol.hasInstance` hook preserve both contracts. The
ordinary function check remains first, retaining native instances and subclass
semantics. Copied names, metadata and spread objects do not acquire identity.
See the [ECMAScript instance check](https://tc39.es/ecma262/multipage/fundamental-objects.html#sec-function.prototype-%symbol.hasinstance%).

Known views expose schema metadata, `getBytes`, `resolve` and `toJSON` without
adding enumerable fields. JSON keeps the preceding view shape. Serialization
uses the shared codec and current fields; request resolution uses the existing
bounded resolver. Owned views are marked for reconstruction with the selected
SDK's constructors before invocation. Unknown future constructors remain plain.
Canonical `client.invoke` responses retain their original objects and shape.

The [checked example](../../../examples/typed-account-class-identity.ts) verifies
class narrowing and bound operations. A [portable fixture](../../../experiments/typed-account-class-sdk-fixture.ts)
also compiles against both actual SDKs. Existing generated class declarations
already express these guards, so no declaration change is required or claimed.
The [research inventory](data/account-class-identity.json) preserves installed
SDK versions, source hashes and comparison counts.

## Reproduction and verification

```sh
node --loader ./experiments/account-class-identity-before-loader.mjs --test tests/account-class-identity.test.js
node --test tests/account-class-identity.test.js
node --max-old-space-size=64 --stack-size=512 experiments/account-class-identity-budget.mjs
```

All 22 focused cases pass; frozen preceding source fails 21 and retains one
existing native-instance guard. The finite schema test checks class guards, complete serialized bytes, original
enumerable fields and plain prototypes for all 2,627 non-Bool definitions. A
second corpus compares 1,931 compatible GramJS and 2,623 compatible teleproto
definitions with their actual serializers, alongside all 2,627 shared views.
The two Bool constructors retain the existing boolean conversion.

Actual nested SDK models verify exact IDs and detached reference bytes. Request
views resolve peers and reject constructor-only resolution. Selected requests
are rebuilt as actual SDK runtime instances with identical compatible bytes.
Ten selected-route cases preserve nested media/message guards, bound replies and
origin hashes. Two independent encrypted TCP cases verify both styles after
wire decoding. Canonical identity, fake metadata, unknown classes, JSON shape
and derived-class behavior have explicit guards.

The capped probe creates and serializes 10,000 finite views under a 64 MiB heap
and 512 KiB stack. Its observed maximum RSS is 109,884 KiB. The probe does not
establish a general memory bound for arbitrary application data.

An initial TCP fixture referenced a nonexistent connection field before entering
cleanup and left two local test servers open. Those bounded test processes were
terminated, and the fixture now constructs the adapter inside `try/finally` with
the actual client. This fixture defect is not a product regression. A later byte
comparison correctly exposed different historical `sendMessage` constructor IDs;
the runtime-reconstruction check now uses a layout supported by both SDKs. It
does not claim an older-schema bridge.

## Remaining scope

All 4,417 core tests pass on Node, Bun and Deno. The focused cases also pass on
Node 20. Strict static/generation checks and actual SDK declaration compilation
pass, with 196 production sources and zero clones. All 71 framework cases pass
on Node 20/26, Bun and Deno; 27 terminal, eight Node 20 wire, sixteen fact-parser
and bounded FIFO checks pass. Packaging retains 241 permitted entries. A bare
Node discovery command additionally collected archived research scripts and
failed; the repository's explicit `npm test` command passes.

Import the replacement `Api` namespace from Anygram when migrating. Foreign SDK
constructors retain their own identity checks; this change does not modify those
libraries or their global registries. Full refined account types/results, drafts,
array totals, legacy integer methods, historical schema negotiation and every
wider unfinished issue criterion remain open. These finite local comparisons do
not establish controlled-account production interoperability.
