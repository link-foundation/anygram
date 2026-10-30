import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const root = new globalThis.URL('../', import.meta.url);
const prior = JSON.parse(
  await readFile(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/account-parse-mode.json',
      root
    )
  )
);
const sources = [];
await mkdir(new globalThis.URL('ci-logs/', root), { recursive: true });
for (const [name, url] of [
  ['entities', 'https://core.telegram.org/api/entities'],
  ['formatting', 'https://core.telegram.org/bots/api#markdownv2-style'],
]) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Primary source ${name}: HTTP ${response.status}`);
  }
  const bytes = new Uint8Array(await response.arrayBuffer());
  await writeFile(
    new globalThis.URL(`ci-logs/account-markdown-${name}.html`, root),
    bytes
  );
  sources.push({
    url,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const facts = {
  recordedAt: new Date().toISOString(),
  installed: prior.installed.map((sdk) => ({
    ...sdk,
    files: sdk.files.filter((file) =>
      /extensions\/markdown|messageParse/.test(file.path)
    ),
  })),
  primarySources: sources,
  contract: {
    aliases: {
      markdown: ['md', 'markdown'],
      markdownv2: ['md2', 'markdownv2'],
    },
    legacyDelimiters: ['**', '__', '~~', '`', '```'],
    modernDelimiters: ['*', '_', '__', '~', '||', '`', '```'],
    dates:
      'tg://time?unix=<seconds>&format=<r|w?[dD]?[tT]?>, plus HTML tg-time',
    offsetUnits: 'UTF-16 code units',
    limits: {
      inputCodeUnits: 4194304,
      outputCodeUnits: 4194304,
      entities: 1000,
      nesting: 64,
      tokens: 100000,
      outputParts: 100000,
      quoteLines: 100000,
    },
    validation:
      'Exact signed-64-bit IDs; bounded spans; crossing and isolated nested entities rejected; blockquotes render only as complete unnested lines.',
  },
  differences: [
    'Pinned legacy SDKs split triple fences into inline code and parse emphasis inside code. Owned scanning protects both code forms and extracts fence languages.',
    'Owned legacy mode retains unmatched delimiters, honors escapes and supports exact links, emoji and dates. Plain outer whitespace is retained; individual entity ends follow official trimming rules.',
    'Pinned GramJS MarkdownV2 uses hyphens for italics and omits standard underscore semantics. Current teleproto is the modern comparison oracle; GramJS differences remain explicit.',
    'MarkdownV2 outer whitespace is trimmed, matching the teleproto HTML-based parser. Plain output and code/URL contexts use distinct escaping.',
    'Owned conversion validates malformed ranges and forbidden nesting rather than silently discarding entities. Unrepresentable date flag combinations and inline/nested blockquote rendering fail explicitly.',
  ],
  regression: {
    beforeCommit: 'f315c14e5e14256b8823537af2e163dfa5296c1c',
    tests: [
      'tests/account-markdown.test.js',
      'tests/account-markdown-boundaries.test.js',
      'tests/account-markdown-rpc.test.js',
    ],
    frozenCases: 128,
    frozenFailures: 128,
    runtime:
      'node --loader ./experiments/account-markdown-before-loader.mjs --test tests/account-markdown*.test.js',
    declarations:
      'node experiments/composer-fluency-check.mjs --account-markdown --before',
    finiteProbe:
      'node --max-old-space-size=192 --stack-size=512 experiments/account-markdown-bounds.mjs',
  },
  remaining: [
    'SDK default Markdown selection',
    'File/album parsing',
    'Current-schema bridges',
    'Full wider issue criteria and controlled-account checks',
  ],
};
await writeFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/account-markdown.json',
    root
  ),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log('Recorded independent Markdown conversion evidence');
