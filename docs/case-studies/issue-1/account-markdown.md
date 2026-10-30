# Independent account Markdown conversion

Explicit `md`/`markdown` and `md2`/`markdownv2` modes use owned synchronous
parsers across canonical clients, both account styles and bound text/reply/edit
helpers. `MarkdownParser`, `MarkdownV2Parser` and `DEFAULT_DELIMITERS` are
exported at the root and through both SDK-style extension paths, with optional
`.js`. [Checked examples](../../../examples/typed-account-markdown.ts) and
[extension imports](../../../examples/typed-account-markdown-imports.ts) compile.
Explicit entities, `FormattedText` and disabled parsing preserve their precedence.

The scanner and writer share existing UTF-16 span validation and exact ID
conversion. Legacy delimiters use double asterisks/underscores/tildes; modern
delimiters use single asterisks/underscores/tildes, double underscores and spoiler
bars. Code and triple fences protect their contents. Links retain escaped URL
parentheses, exact user/custom-emoji IDs and current `tg://time` date syntax.
Current `<tg-time>` dates also work in HTML. MarkdownV2 supports complete-line
quotes, collapsed quotes, carriage-return separators and all ASCII escapes.
Output escapes plain, code and URL contexts separately.

## Reproduction and verification

Before implementation, the first 98 cases failed against the preceding source.
The final 128-case corpus fails completely against immutable HTML head
`f315c14e5e14256b8823537af2e163dfa5296c1c`. Its declarations also reproduce nine
diagnostics for missing exports/modes. The positive corpus passes. Five extra
failing-before quote cases exposed equal-span formatting putting `>` inside
style/link markers. Quotes now precede their full-span children independent of
the caller's entity order; those cases are part of the 128-case corpus.

```sh
node --loader ./experiments/account-markdown-before-loader.mjs --test tests/account-markdown*.test.js
node --test tests/account-markdown*.test.js
node experiments/composer-fluency-check.mjs --account-markdown --before
node experiments/composer-fluency-check.mjs --account-markdown
node --max-old-space-size=192 --stack-size=512 experiments/account-markdown-bounds.mjs
```

Six actual SDK send/edit byte comparisons check the parsed requests. Current
teleproto bytes match completely. Older GramJS method IDs differ by four bytes;
all following argument bytes match, and owned requests serialized through GramJS
match that SDK's complete bytes. Ten selected-route cases cover all five
adapters. Two independent encrypted TCP cases each check history, send, bound
reply and edit, retaining exact source peer hashes and message IDs. Abort and
typed lookup failures stop before sending; explicit empty entities skip parsing.

The finite probe passes with a 192 MiB heap and 512 KiB stack, including 4 Mi
code-unit plain/unclosed constructs, repeated missing link boundaries and finite
token overflow. The measured peak was 184,864 KiB RSS on this host. It establishes
these finite bounds, rather than a universal runtime or memory guarantee. Limits
are 4 Mi input/output code units, 1,000 entities, nesting below 64, 100,000
tokens/output parts and 100,000 quote lines. Escaped output uses
[allocation preflight](markup-allocations.md).

## SDK differences and remaining criteria

Both pinned legacy parsers split triple fences into inline code and interpret
emphasis inside protected code. The owned scanner preserves code and fence
languages. It also retains unmatched delimiters and honors escapes. Legacy outer
whitespace remains intact; modern outer whitespace follows teleproto trimming.
Entity ends follow the official whitespace rules. Pinned GramJS MarkdownV2 uses
hyphens for italics and misses standard underscore behavior, so modern comparisons
use current teleproto and separately assert the GramJS discrepancy.

Crossing ranges, isolated nested entities, unsafe numeric IDs, invalid date flags
and inline/nested quote rendering fail explicitly. Ordinary quote/style nesting
is supported; a quote cannot wrap isolated code/pre/date entities in this bounded
implementation. Full Telegram formatting parity remains open.

The [facts inventory](data/account-markdown.json) preserves pinned SDK files,
source hashes, primary references, limits and reproduction commands. The scanner
does not execute SDK parser code or a browser HTML converter. SDK default
Markdown selection, file/album parsing, complete model/declaration compatibility,
older-schema bridges, controlled-account scenarios and wider issue criteria
remain unfinished.
