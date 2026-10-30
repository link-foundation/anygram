import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new globalThis.URL('../', import.meta.url);
const prior = JSON.parse(
  await readFile(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/account-parse-mode.json',
      root
    )
  )
);
const characters = JSON.parse(
  await readFile(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/html-character-references.json',
      root
    )
  )
);
const facts = {
  recordedAt: new Date().toISOString(),
  installed: prior.installed.map((sdk) => ({
    ...sdk,
    files: sdk.files.filter(
      (file) =>
        file.path.includes('/html.') || file.path.includes('messageParse')
    ),
  })),
  primarySources: [...prior.primarySources, characters],
  characterTableSha256: createHash('sha256')
    .update(
      await readFile(new globalThis.URL('src/schema/html-entities.json', root))
    )
    .digest('hex'),
  contract: {
    aliases: ['html'],
    offsetUnits: 'UTF-16 code units',
    namedReferences: characters.entries,
    tags: [
      'b',
      'strong',
      'i',
      'em',
      'u',
      'ins',
      's',
      'del',
      'strike',
      'spoiler',
      'tg-spoiler',
      'span.tg-spoiler',
      'code',
      'pre',
      'blockquote',
      'a',
      'tg-emoji',
      'tg-date',
      'br',
    ],
    limits: {
      inputCodeUnits: 4194304,
      outputCodeUnits: 4194304,
      entities: 1000,
      nesting: 64,
      tags: 100000,
      outputParts: 100000,
      attributesPerTag: 1000,
    },
    output:
      'Owned schema entities, exact signed-64-bit identifiers, escaped text and attributes, validated balanced nesting.',
  },
  differences: [
    'Pinned GramJS omits ins/strike/tg-spoiler/span.tg-spoiler tags accepted by teleproto and the owned parser.',
    'Owned unparse accepts canonical, owned and both actual SDK entity objects, including plain text escaping and expandable quotes.',
    'Different mailto labels preserve the original URL and visible label as TextUrl; SDKs discard one of them.',
    'Unclosed tags are finalized and misnested closing tags close inner tags first. Every trimmed entity is clipped independently.',
    'Named references follow the standard longest-prefix and attribute rules. Invalid Unicode numeric references become the replacement character; C1 references use the standard replacements.',
    'Zero, malformed and oversized mention/emoji IDs fail before transport; invalid ranges, crossing entities and nested code/pre/date entities are rejected.',
  ],
  regression: {
    beforeCommit: '2c40acd5ade91284195e2363c41d28f22e96de6d',
    tests: [
      'tests/account-html.test.js',
      'tests/account-html-boundaries.test.js',
      'tests/account-html-rpc.test.js',
      'tests/account-html-import.test.js',
    ],
    runtime: 'experiments/account-html-before-loader.mjs',
    declarations:
      'node experiments/composer-fluency-check.mjs --account-html --before',
    finiteProbe:
      'node --max-old-space-size=192 --stack-size=512 experiments/account-html-bounds.mjs',
  },
  remaining: [
    'Markdown and MarkdownV2 builtins',
    'SDK default Markdown selection',
    'File/album parse-mode integration',
    'Full wider issue criteria and controlled-account checks',
  ],
};
await writeFile(
  new globalThis.URL('docs/case-studies/issue-1/data/account-html.json', root),
  `${JSON.stringify(facts, null, 2)}\n`
);
console.log('Recorded independent HTML conversion evidence');
