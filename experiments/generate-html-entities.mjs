import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new globalThis.URL('../', import.meta.url);
const url = 'https://html.spec.whatwg.org/entities.json';
const response = await fetch(url);
if (!response.ok) {
  throw new Error(`Cannot fetch character references: ${response.status}`);
}
const bytes = new Uint8Array(await response.arrayBuffer());
const source = JSON.parse(new globalThis.TextDecoder().decode(bytes));
const values = Object.fromEntries(
  Object.entries(source).map(([name, entry]) => [
    name.slice(1),
    entry.characters,
  ])
);
const output = `${JSON.stringify(values, null, 2)}\n`;
const target = new globalThis.URL('src/schema/html-entities.json', root);
if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== output) {
    throw new Error('Character-reference data differs from the primary source');
  }
} else {
  await writeFile(target, output);
  await writeFile(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/html-character-references.json',
      root
    ),
    `${JSON.stringify({ url, sha256: createHash('sha256').update(bytes).digest('hex'), entries: Object.keys(values).length }, null, 2)}\n`
  );
}
console.log(
  `Verified ${Object.keys(values).length} WHATWG character references`
);
