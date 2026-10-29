# Bounded local persistence

The shared file store used an unbounded `readFile` before validating session
content. A malformed local file could therefore allocate its entire contents.
Writes also accepted buffers and had no byte limit. Follow's input reader had
its own separate bounded loop.

`tests/storage-limits.test.js` reproduced six failures before implementation
(`ci-logs/storage-limits-before.log`). Seven regressions now verify byte-based
read/write limits, prior-file preservation, queue recovery, split UTF-8 chunks,
missing files and other filesystem errors, invalid limits, pre-cancellation
whose original reason carries `ENOENT`, and both follow session import paths.
All probes use finite inputs; the largest new fixture is about 70 KiB.

`readTextFile` now shares one bounded reader with the store and follow. It reads
at most the configured limit plus one byte, checks cancellation before opening
and between reads, closes the descriptor in `finally`, and decodes assembled
bytes once. Limits must be integers between 1 byte and 16 MiB. The general store
defaults to 16 MiB for update/state snapshots; follow session files use 8 KiB,
and follow environment/input files use 256 KiB. Writes validate before creating
directories or temporary files, and retain the atomic private-file writer.

All 514 tests pass locally on Node, Bun and Deno. Strict ESLint, Prettier,
TypeScript declarations/examples and the full duplication check pass, with zero
clones across 73 production files. Logs are retained locally as
`ci-logs/storage-{node,bun,deno,check,strict}.log`. The new typed storage example
checks optional cancellation, byte limits and URL paths. Fresh matrix CI is
required for this checkpoint; the preceding constructor run 40834951184 was
still queued when local checks completed. This checkpoint does not complete the
remaining protocol, backend compatibility or downstream application criteria.
