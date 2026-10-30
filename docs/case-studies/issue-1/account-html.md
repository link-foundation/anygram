# Independent account HTML conversion

The shared account parse-mode setting accepts `html` or the exported
`HTMLParser`. Canonical send/edit methods, both account styles, bound
reply/edit helpers and detached message text views use the same implementation.
This advances R01/R02/R05/R17/R19; the wider issue remains open.

SDK-style imports are available at `anygram/extensions/html.js` and
`anygram/extensions/html`, with matching declarations. Two failing-before
import tests verify both paths; both exports refer to the same parser.

```js
client.setParseMode('html');
await client.teleproto.sendMessage('me', { message: '🚀 <b>Ada</b>' });
const [text, entities] = HTMLParser.parse(
  '<a href="https://example.com">Ada</a>'
);
const html = HTMLParser.unparse(text, entities);
```

The scanner is independent of optional SDKs and a browser DOM. It covers both
SDKs' supported tags: emphasis aliases, spoilers, code and language-bearing pre
blocks, expandable blockquotes, URL/email/mention links, custom emoji and all
six formatted-date flags. Line breaks produce newlines. Unknown tags retain
their content; comments are removed. Identifiers stay exact through bigint,
and dates use timestamp seconds. Explicit entity arrays still override parsing.

The generated table contains all 2,231 named references from the
[WHATWG primary source](https://html.spec.whatwg.org/entities.json). Text and
attribute decoding follow their respective longest-prefix rules, including
legacy references without semicolons. Invalid Unicode numeric references use
the replacement character, and C1 references use the standard replacements.
The generator records the downloaded source hash; `--check` verifies it against
the current published data. No optional dependency supplies the table at runtime.

[Telegram's entity rules](https://core.telegram.org/api/entities) establish
UTF-16 offsets, trimmed entity ends and entity families. The
[formatting reference](https://core.telegram.org/bots/api#formatting-options)
defines HTML tags and nesting constraints. Input/output are bounded to 4 Mi
UTF-16 code units, with 1,000 entities, depth 64 and independently bounded
100,000 tags/output parts and 1,000 attributes per tag. Crossing spans and nested code/pre/date entities
fail before rendering or sending. All output text and attribute values are
escaped, including when there are no entities.

## Reproduction and evidence

Before implementation, 55 of the first 58 cases failed because builtin HTML
was absent. The final 94-case suite passes; frozen preceding source fails 91.
The three invalid-identifier send guards also failed safely before implementation
because that source rejects any `html` setting; they are not missing-feature
reproductions. Frozen declaration checks expose the missing parser export and
string setting. The [checked example](../../../examples/typed-account-html.ts)
and actual SDK entity declaration fixture verify the public boundary.

```sh
node --test tests/account-html*.test.js
node --loader ./experiments/account-html-before-loader.mjs --test tests/account-html*.test.js
node experiments/composer-fluency-check.mjs --account-html --before
node --max-old-space-size=192 --stack-size=512 experiments/account-html-bounds.mjs
node experiments/generate-html-entities.mjs --check
```

The immutable runner loads production entry points and mode selection from
`2c40acd5ade91284195e2363c41d28f22e96de6d`. Tests cover every named reference,
each supported tag, all date flags, real owned/GramJS/teleproto constructors,
detached input, balanced adjacent/nested spans, malformed quoted tags, invalid
identifiers, trimming, finite limits, cancellation and typed lookup failures.
Two additional failing regressions preceded fixes for dropped literal `<3>`
and attribute `&amp=` decoding. Two review regressions additionally bound
duplicate attributes and reject inexact numeric IDs. Finite maximum-size inputs and malformed inputs
pass under a 192 MiB heap and 512 KiB stack; observed Linux peak RSS was
117,064 KiB. The TCP test closes its peer even when frozen mode selection fails.

All named-reference expectations also match GramJS's independent installed
HTML tokenizer, in addition to checking the primary-source table.

Four actual installed SDK send/edit comparisons match complete SDK-serialized
requests. Current teleproto bytes also match the owned codec. GramJS's older
four-byte method IDs differ explicitly; all following argument bytes match.
Five selected raw adapters and a four-request encrypted native TCP test verify
shared parsing, source peer hashes, reply linkage and edit IDs.

## SDK differences and remaining criteria

Pinned GramJS omits aliases accepted by teleproto, including `ins`, `strike`,
`tg-spoiler` and spoiler spans. Its unparser checks nominal SDK classes and
leaves plain text unescaped. Owned conversion accepts all four object forms
and escapes output consistently. The comparisons retain these differences.

Both SDKs lose either the URL or visible text when a `mailto:` label differs
from its address. Owned conversion retains both with a TextUrl entity. Unclosed
tags finalize their spans, misnested close tags close inner tags first, and
trimming clips each entity independently. Named-reference and invalid-numeric
decoding follow the standard rather than reproducing SDK decoder defects.
The [facts inventory](data/account-html.json) records pinned source hashes,
primary references, limits and regression commands; the
[SDK probe](../../../experiments/account-markup-sdk-probe.mjs) records a finite
HTML/Markdown/MarkdownV2 comparison corpus in `ci-logs`.

Independent [Markdown/MarkdownV2 builtins](account-markdown.md) now share the
account paths. The same follow-up adds current `tg-time` HTML dates; the legacy
`tg-date` spelling remains supported. [Output preflight](markup-allocations.md)
rejects oversized escaping before allocating the expanded string.

Explicit [file/album captions and replacement-media edits](account-media-formatting.md)
now share HTML conversion and validation before consuming upload sources.
SDK default Markdown selection, complete media options,
complete SDK model/declaration parity, current-schema bridging,
controlled account scenarios and wider acceptance criteria remain unfinished.
