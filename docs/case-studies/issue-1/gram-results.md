# GramJS-style invocation results

The GramJS/teleproto facade previously returned raw backend objects from `invoke`
and `sendMessage`, while its account helpers returned detached camelCase data.
Eight failing-before regressions in `ci-logs/gram-results-before.log` capture
missing camelCase fields and vendor byte-buffer aliasing. Both facade methods
now reuse the existing shared view conversion. Direct `Anygram.invoke` retains
the raw backend result. String and class request arguments and cancellation
options continue through the same selected route.

Nine regressions cover actual GramJS/teleproto response classes, all five backend
routes, nested media fields and exact 64-bit IDs, mutation isolation, errors,
send options and encrypted native TCP. The existing follow callback assertion
now checks the facade's camelCase `firstName` field. This is a data-view contract;
vendor custom message methods, totals, result correlation and `instanceof`
behavior remain open. A native send result can still be an Updates container.

The additional view tests exposed a resource gap in canonical normalization:
top-level arrays recursed before reaching the shared request walker. Six bounded
failing-before probes are retained in `ci-logs/result-limits-before.log`.
Normalization now applies that existing walker to the complete value, including
root arrays, instead of adding another conversion implementation. Its depth and
vector guards reject before visiting rejected children. Seven tests cover both
guards through canonical conversion, camelCase views and routed results, plus
valid repeated references, primitives and actual vendor integers. Getter probes
stop after 72 reads and the oversized sparse vector has 100001 entries.
`experiments/result-limits.mjs` separately uses finite nested arrays with a
512 KiB stack and 128 MiB heap.

This advances R01/R08/R12 while leaving complete backend and downstream parity
open. Node, Bun and Deno each pass all 565 tests. Strict lint, formatting,
TypeScript compilation/regeneration and the zero-clone scan of 77 production
sources pass. The package contains 120 permitted entries. Logs are preserved
under `ci-logs/gram-results-*` and `ci-logs/result-limits-*`. Fresh matrix CI is
required for this checkpoint.
