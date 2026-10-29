# Bot handler recovery

Node-style event callbacks ran before the shared dispatch `try` block. A thrown
or rejected `message` or `onText` listener therefore bypassed `bot.catch`, even
though middleware errors entered it. This could stop polling despite an
application's registered recovery handler. The Telegraf facade also inherited
the shared wrapped-error callback instead of Telegraf's `(error, context)` form.

Seven of the initial nine cases fail before implementation; the passing cases
preserve existing unhandled-error and shared middleware behavior. The original
failures are retained in `ci-logs/handler-errors-before-final.log`. The public
pinned Telegraf implementation independently supplies the expected error/context
identities, primitive errors, asynchronous recovery and handler return values.

## Implementation

The shared dispatch constructs its owning context, then runs event listeners
and middleware inside one recovery boundary. If a listener fails, remaining
dispatch work stops and the configured catcher receives that update's context.
Dispatch awaits recovery before marking the update seen. Unhandled failures or
catcher rejections preserve their exact error and leave the update retryable;
the owned processing entry and queue are released in either case.

The Telegraf view adapts the same recovery boundary to its two-argument callback
without copying the error or context. Shared `Bot` and `TelegramBot` retain the
wrapped error with `cause`, `error` and `ctx`. Nested dispatch keeps each child's
context and queue ownership. Async catcher results propagate through dispatch.
No send or update is retried automatically after an exception.

Checked declarations preserve the distinct generic Telegraf signature and expose
the event facade's existing catcher. `examples/typed-bot-errors.ts` compiles all
three registration styles and event chaining.

## Verification

Run `node --test tests/bot-handler-errors.test.js`. Ten cases cover:

- Public pinned Telegraf error/context identity, primitive thrown values and
  asynchronous catcher results.
- Message and text-pattern listeners, exact wrapped errors, no middleware
  fallthrough and deduplication only after successful recovery.
- A blocked async catcher retaining queue ownership, with explicit release in
  cleanup and an independent finite watchdog.
- Unhandled errors, failed catcher persistence, update retry and later queue
  progress, preserving original error identities.
- Nested event failure recovery under the child context and parent ordering.
- The existing shared middleware error contract.
- Finite native Bot API polling through injected Fetch with two updates,
  recovered event failure and offset advancement after the awaited catcher.

The shared `Bot` intentionally invokes a registered catcher for direct dispatch
as well as polling. Actual grammY applies its polling catcher only in its runner;
this change preserves the existing shared contract and does not establish full
grammY dispatch parity. Node-style catchers are a shared-library extension.
Framework aliases, complete plugin behavior and the other issue requirements
remain unfinished.

The first full Node run passed 756 of 757 cases and exposed a separate fixture
budget coupling: the raw grammY signature comparison inherited `clientFor`'s
250 ms default, despite using a three-second caller signal. Its timeout appears
at `ci-logs/handler-errors-full-node.log:851`. The isolated comparison passes;
the full parallel run exceeded that short request deadline. This wire-only case
now explicitly uses the same two-second request budget as the other successful
wire comparisons. Production defaults and deadline-specific tests are unchanged.
The next full Node run passes all 757 cases.

All 757 core cases pass on Node, Bun and Deno. The ten handler cases and fifteen
canonical bot-operation cases also pass on Node 20.18.3.
Strict ESLint, formatting, complete declaration/example compilation and exact
schema regeneration pass. The duplication gate scans 84 production sources with
zero clones; the npm dry run has 127 permitted package entries. Thirteen native
terminal cases pass. Fresh main is an ancestor of the branch.
