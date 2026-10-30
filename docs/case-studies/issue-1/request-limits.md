# Request normalization limits

Both raw canonical conversion and vendor-class reconstruction previously visited
nested fields and vector elements before the TL writer checked its configured
limits. A recursive request could exhaust the call stack during normalization;
a rejected vector could run element getters and allocate its converted copy.
Seven bounded, failing-before regressions preserve these failures in
`ci-logs/request-limits-before.log`. Their getters stop after eight visits, so the
reproductions cannot exhaust the host stack or memory.

Both conversion paths now use one shared walker. It checks depth and vector
length before visiting children, defaults to depth 64 and 100000 vector entries,
and validates finite integer limits. Native calls supply their codec's limits
before entering the request queue. The TL writer supplies its remaining depth
and vector limits before normalizing each object. Existing vendor request
instances still pass through unchanged; their vendor runtime owns serialization.

Eight tests cover both conversions, valid exact boundaries, repeated acyclic
references, rejected limits, codec serialization and native rejection before
transport work. `experiments/request-limits.mjs` separately exercises a finite
2000-wrapper request and a 17-entry sparse vector. It passes with Node's
`--stack-size=512 --max-old-space-size=128` limits.

Node, Bun and Deno each pass all 532 tests. Strict ESLint, formatting, TypeScript
compilation/regeneration and the 76-source zero-clone scan pass. The package
surface is unchanged from the native-class checkpoint. Logs are retained under
`ci-logs/request-limits-*`. Head d5f84c0 passed all nine runtime/OS jobs and
applicable gates in [run 40838745111](https://github.com/link-foundation/anygram/actions/runs/40838745111),
created 2026-10-29T07:57:15Z and completed 2026-10-29T08:01:17Z. This guards
normalization depth and vector sizes; it does not establish complete protocol,
runtime or application compatibility.
