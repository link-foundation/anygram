# AES-IGE allocation regression

[PR #2](https://github.com/link-foundation/anygram/pull/2) run 40954349985
tested baff2293a7163ff9dfdd847dc14684c56bbeefe4. The macOS Bun job failed
the existing encrypted upload test above 10 MiB after 5,180.48 ms. Preserved
failed-step log lines 2304–2305 identify the five-second deadline. The input,
assertions and deadline stay unchanged.

The AES-IGE loop allocated two XOR buffers per 16-byte block. Each XOR used
Buffer.map followed by Buffer.from, allocating and copying four block buffers
in addition to the final output. A synchronous probe counts bytes returned by
Buffer.alloc, Buffer.from and Buffer.prototype.map. For a finite 1 MiB input,
the old loop requests 5,242,880 bytes through these public methods. The revised
loop requests 1,048,592: one output and one reusable 16-byte mixing buffer.
Native cipher.update allocations, JavaScript object overhead and process RSS
are outside this measurement; it is not a total-memory benchmark.

Encryption mixes into the reusable buffer and writes the second XOR directly
into the output. Previous-block views retain the IGE chaining values for both
directions. Two 64 KiB regression tests compare ciphertext/plaintext against
the independently installed GramJS IGE implementation, verify unchanged caller
input/key/IV and enforce a public-buffer budget. Both fail against the frozen
production source and pass after the change. The existing independent cipher,
authenticated envelope, secret-file and native protocol tests cover surrounding
behavior. A local Bun focused run completes the unchanged large-file case in
356.33 ms. [Run 40956444029](https://github.com/link-foundation/anygram/actions/runs/40956444029)
then passes every core runtime/OS job, including the unchanged macOS Bun case.
Three independent Deno framework jobs still fail; the clean-checkout workflow
correction is documented in [framework evidence](web-frameworks.md).

Reproduce the bounded allocation failure and probe from a checkout containing
the preserved commit:

```sh
node --max-old-space-size=64 --stack_size=512 --loader ./experiments/ige-before-loader.mjs --test tests/crypto-resources.test.js
node --max-old-space-size=64 --stack_size=512 --loader ./experiments/ige-before-loader.mjs experiments/ige-allocation-probe.mjs
node --max-old-space-size=64 --stack_size=512 --test tests/crypto-resources.test.js
node --max-old-space-size=64 --stack_size=512 experiments/ige-allocation-probe.mjs
```

The loader freezes only src/crypto.js at
d949e9b9e06bd7b3d63907c164ab87f9bbcc8de3. Inputs and process limits are finite.
The allocation assertion avoids a timing threshold: CI still exercises the
existing upload deadline. This verifies a specific allocation regression;
the issue's wider performance, interoperability and compatibility requirements
remain open in the acceptance ledger.

All 2,265 checkpoint tests pass on Node, Bun and Deno, with 27 native and eight
Node 20 wire integration checks. Strict lint, formatting, type/declaration and
duplication gates pass (168 production sources, zero clones); the package dry run
has 211 permitted entries. These runs use every committed core test plus the two
new cipher regressions. Uncommitted tests for the separately unfinished media
conversion work are excluded from this atomic checkpoint.
