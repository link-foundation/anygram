import { readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';
import { filterQuerySpellings } from './filter-query-spellings.mjs';

const root = new globalThis.URL('../', import.meta.url);
const facts = JSON.parse(
  readFileSync(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/grammy-filter-facts.json',
      root
    )
  )
);
if (
  facts.version !== '1.46.0' ||
  facts.sha256 !==
    'f68dde2272adbb079f27ddf7c30a111e80847f35ba449adaca08eddaac84d46a'
) {
  throw new Error('Unreviewed grammY filter-key pin');
}
const file = 'src/bot-filter-facts.js';
const output = await format(
  `// Public filter-key facts; independently compiled by bot-filter-query.js.
// Regenerate: node experiments/generate-context-filter-facts.mjs
export const filterRoot = ${facts.root};
export const filterNodes = Object.freeze(${JSON.stringify(facts.nodes)});
export const filterShortcuts = ${JSON.stringify(facts.shortcuts)};
`,
  { filepath: file, singleQuote: true, trailingComma: 'es5' }
);
const path = new globalThis.URL(file, root);
const declarations = await format(
  `// Public filter-key facts; regenerated with the runtime facts.
export declare const filterRoot: ${facts.root};
export declare const filterNodes: readonly ${JSON.stringify(facts.nodes)};
export declare const filterShortcuts: readonly ${JSON.stringify(facts.shortcuts)};
`,
  { parser: 'typescript', singleQuote: true, trailingComma: 'es5' }
);
const { queries } = filterQuerySpellings(facts);
const outputs = [
  [path, output],
  [new globalThis.URL('src/bot-filter-facts.d.ts', root), declarations],
];
const groups = [];
for (let offset = 0; offset < queries.length; offset += 300) {
  const name = `FilterQueries${offset / 300}`;
  groups.push(name);
  const content = await format(
    `// Independently enumerated from reviewed public filter facts.
export type ${name} = ${queries
      .slice(offset, offset + 300)
      .map((query) => JSON.stringify(query))
      .join(' | ')};`,
    { parser: 'typescript', singleQuote: true, trailingComma: 'es5' }
  );
  outputs.push([
    new globalThis.URL(`src/bot-filter-queries${offset / 300}.d.ts`, root),
    content,
  ]);
}
outputs.push([
  new globalThis.URL('src/bot-filter-queries.d.ts', root),
  await format(
    `${groups.map((name, index) => `import type { ${name} } from './bot-filter-queries${index}.js';`).join('\n')}
export type FilterQuery = ${groups.join(' | ')};`,
    { parser: 'typescript', singleQuote: true, trailingComma: 'es5' }
  ),
]);
const generated = new Set(outputs.map(([destination]) => destination.href));
const directory = new globalThis.URL('src/', root);
for (const filename of readdirSync(directory)) {
  const destination = new globalThis.URL(filename, directory);
  if (
    /^bot-filter-queries\d+\.d\.ts$/.test(filename) &&
    !generated.has(destination.href)
  ) {
    if (process.argv.includes('--check')) {
      throw new Error(`Stale filter query declaration group: ${filename}`);
    }
    rmSync(destination);
  }
}
for (const [destination, content] of outputs) {
  if (process.argv.includes('--check')) {
    if (readFileSync(destination, 'utf8') !== content) {
      throw new Error('Stale public context filter-key facts');
    }
  } else {
    writeFileSync(destination, content);
  }
}
console.log(
  `Verified ${facts.nodes.length} public filter-key groups and ${queries.length} query spellings`
);
