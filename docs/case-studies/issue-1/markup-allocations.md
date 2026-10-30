# Escaped-output allocation investigation

HTML head `f315c14e5e14256b8823537af2e163dfa5296c1c`, committed at
2026-10-30T00:53:58Z, triggered [run 40982579102](https://github.com/link-foundation/anygram/actions/runs/40982579102)
at 00:54:16Z. The macOS Intel/Bun job failed two existing five-second checks:
account HTML output bounds took 5,155.45 ms and rich HTML output bounds took
14,235.55 ms. Preserved job log `ci-logs/html-bun-macos-40982579102.log` records
the failures at lines 782–783 and 2063–2064. The complete run log is preserved
in `ci-logs/html-40982579102.log`.

Both paths expanded strings with callback-based `replace` before checking the
result's size. Finite allocation probes reproduced 4,500,000 escaped code units
from 900,000 ampersands and 18,874,368 from 3 Mi quotation marks before rejection.
Both inputs exhausted separately capped 64 MiB heaps against frozen source.
These probes use finite input, a 512 KiB stack and disabled core dumps, so the
failing experiment cannot exhaust the host.

Shared `escapeBounded` first counts the expansion using literal searches. It
throws the same bounded error before constructing an oversized result, then
uses ordered literal replacements for accepted input. HTML, rich HTML and the
new Markdown writer share the guard. Replacement order protects newly inserted
ampersands/backslashes. Existing output limits and five-second deadlines remain
unchanged.

Two automated allocation regressions fail against frozen source and pass with
the guard. They instrument synchronous string replacement only within a
`try`/`finally` scope and restore both methods before returning. Both bounded
64 MiB probes now pass: measured peak RSS was 77,112 KiB for account HTML and
79,344 KiB for rich HTML. RSS includes runtime memory outside the JavaScript heap;
these host measurements do not establish a universal performance guarantee.

```sh
node --test tests/markup-allocations.test.js
node --max-old-space-size=64 --stack-size=512 experiments/markup-output-bounds.mjs html
node --max-old-space-size=64 --stack-size=512 experiments/markup-output-bounds.mjs rich
```

To reproduce the frozen capped-heap failures, disable core dumps and add
`--loader ./experiments/markup-output-before-loader.mjs` to each probe. Full local
and fresh exact-head OS/runtime checks remain required before the follow-up's CI
verification is complete.
