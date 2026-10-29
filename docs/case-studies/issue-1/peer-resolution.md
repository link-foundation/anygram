# Native request peer resolution

Owned `Api` requests previously serialized shortcut strings as if they were TL
objects. The initial failing-before regressions are preserved in
`ci-logs/api-resolution-before.log`. Requests now resolve InputPeer, InputUser,
InputChannel, InputDialogPeer and InputNotifyPeer shortcuts through the selected
backend's existing entity resolver. InputMessage accepts numeric IDs and message
objects. Fully specified objects keep their identity and avoid extra lookups.
The shared resolver follows known schema fields, including generic queries,
story media, reply objects and message-origin peer constructors. Missing optional
fields remain absent. Generated declarations accept the same shortcuts.

`Anygram.invoke` resolves owned native requests before passing them to the selected
adapter. GramJS and teleproto receive their actual request classes; object-based
backends receive canonical requests. Existing vendor request instances keep their
existing path. Lookup errors are preserved without sending the final request or
replaying through another backend. Cancellation is checked before lookups and
after each awaited lookup. Underlying vendor lookups retain their own cancellation
behavior; cancellation still prevents the final send.

Seventeen regressions compare actual GramJS/teleproto argument bytes for six
request shapes, check all five backend routes and caching, and execute username
resolution followed by message submission over encrypted native TCP. The pinned
GramJS SendMessage constructor has an older ID, so its argument bytes are compared
after the four-byte constructor ID; the independent schema corpus checks IDs.
The pinned vendor dialog wrapper does not itself resolve a raw username, so that
oracle supplies an actual InputPeer while the owned request resolves the username.
These details avoid treating vendor limitations as supported vendor behavior.

Additional failing-before nested tests are preserved in
`ci-logs/api-resolution-nested-before.log`. The resolver validates the complete
request before lookups with the shared depth/vector limits, snapshots vectors
before awaiting and checks depth again during traversal. A bounded mutation probe
changes a later field during an awaited lookup and stops after 72 getter reads;
its failure before the traversal guard is in
`ci-logs/api-resolution-mutation-before.log`. After the fix, excessive depth
rejects without reaching that probe limit.

This closes specific constructor/input gaps in R01 and R12. InputMedia/photo/file
shortcuts, vendor custom models/readers, complete return/event shapes and full
backend/application parity remain open. The request-normalization prerequisite
passed all nine runtime/OS jobs and applicable gates for head d5f84c0 in
[run 40838745111](https://github.com/link-foundation/anygram/actions/runs/40838745111).
Node, Bun and Deno each pass all 549 tests. Strict lint, formatting, TypeScript
compilation/regeneration and the 77-source zero-clone scan pass. The package
contains 120 permitted entries. Logs are retained under `ci-logs/api-resolution-*`.
Fresh CI must verify this checkpoint.
