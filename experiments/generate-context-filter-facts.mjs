import { readFileSync, writeFileSync } from 'node:fs';
import { format } from 'prettier';

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
if (process.argv.includes('--check')) {
  if (readFileSync(path, 'utf8') !== output) {
    throw new Error('Stale public context filter-key facts');
  }
} else {
  writeFileSync(path, output);
}
console.log(`Verified ${facts.nodes.length} public filter-key groups`);
