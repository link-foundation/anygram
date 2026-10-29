# Executing the original terminal tests

The complete eight test files and five debug scripts pinned at
`konard/telegram-terminal-bot@7f3aeee50965160b31dca62b6e5b4e4a7af99bea`
now execute in the isolated native integration command. All thirteen scripts
complete successfully. This supplies execution evidence beyond the previously
archived source/test-path inventory; it does not establish live Telegram delivery.

| Original script               | What its body checks                                                                |
| ----------------------------- | ----------------------------------------------------------------------------------- |
| `test-terminal.js`            | 20 assertions: text, cursor, ANSI, alternate screens, resize and finite performance |
| `test-control-sequences.js`   | 7 assertions: control bytes, cursor preservation and notifications                  |
| `test-subscription-system.js` | 10 assertions: listeners, change flags, errors and finite performance               |
| `test-top-focused.js`         | Two scenarios: three timed frames and verbose updates                               |
| `test-top-simulation.js`      | Three timed/frame-count scenarios; an additional interactive diagnostic             |
| `test-bot-integration.js`     | Four emulator/debounce scenarios through its own bot simulator                      |
| `test-integration.js`         | Diagnostic screens without assertions                                               |
| `test-verbose-mode.js`        | Diagnostic logging without assertions                                               |
| Five `debug/*.js` scripts     | Diagnostic layout, alternate screen and line-clear output without assertions        |

The six assertion-driven scripts cover 46 scenarios. The simulator named
`test-bot-integration.js` does not construct a Telegram SDK or execute either
application, so its output cannot substitute for the separate migrated-handler,
real PTY, rendering or controlled-polling tests. Likewise the seven diagnostic
scripts are counted as completed scripts, not passing behavioral assertions.
The subscription suite deliberately logs an error from one listener and verifies
that another listener still receives the change.

## Execution boundary and resource limits

`experiments/terminal-runtime/upstream-suite-probe.mjs` first verifies each
complete source and emulator against the existing byte/SHA-256 manifest. It
removes the shebang and one exact import, injects the original verified emulator,
and awaits the original asynchronous entry point. It does not change assertions,
delays, frame counts, screen sizes, performance thresholds or emulator behavior.

Direct execution of a debug script first reproduced `ERR_MODULE_NOT_FOUND`:
its `../virtual-terminal.js` import resolves under `src/tests` rather than `src`.
The explicit dependency injection bridges this original path error for debug
scripts too. Original archived sources remain immutable. The preserved local
failure is `ci-logs/terminal-upstream-debug-import-before.log`.

Each script runs sequentially in its own child with a 64 MiB JavaScript heap,
512 KiB stack, 128 KiB combined output budget and 20-second watchdog. The parent
awaits child closure before proceeding. The largest original stress case is
finite at 1000 lines; the longest original timed scenario runs about nine
seconds. Successful exit, explicit completion and the original suite's success
summary are checked. Original `process.exit(1)` only exits the isolated child.

Run:

```sh
ANYGRAM_TERMINAL_LOG_DIR=ci-logs/terminal-upstream \
  node --test experiments/terminal-runtime/upstream-suites.integration.js
npm test --prefix experiments/terminal-runtime
```

The optional environment variable preserves complete per-script output; normal
CI only prints the thirteen execution results and failing output. The first
complete local execution takes 20.35 seconds. All original assertion-driven
suites pass without emulator changes. A debug line-clear script prints an
expected/actual mismatch caused by its already-wrapped sample text; it has no
assertion and is not presented as successful line-clear verification. The
separate original core clear-line assertion passes.

Keyboard/photo behavior, native runtime/platform execution and authenticated
Telegram scenarios remain open. This advances R05/R07/R13/R20/R21 while keeping
those criteria unfinished.
