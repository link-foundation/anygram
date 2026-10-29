import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

const root = new globalThis.URL('../', import.meta.url);
const facts = JSON.parse(
  await readFile(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/bot-api/component-facts.json',
      root
    )
  )
);
const sources = new Map();
for (const [file, hash] of Object.entries(facts.sources)) {
  const data = await readFile(new globalThis.URL(file, root));
  if (createHash('sha256').update(data).digest('hex') !== hash) {
    throw new Error(`Unreviewed SDK component source: ${file}`);
  }
  sources.set(file, data.toString());
}
const cases = [];
for (const [model, entry] of Object.entries(facts.namespaces)) {
  const source = [...sources.values()].find((value) =>
    value.includes(`export declare namespace ${model} {`)
  );
  const block = source
    .split(`export declare namespace ${model} {`)[1]
    .split('\n}')[0];
  const names = [...block.matchAll(/^ {4}interface (\w+)/gm)].map(
    (match) => match[1]
  );
  if (JSON.stringify(names) !== JSON.stringify(Object.keys(entry.aliases))) {
    throw new Error(`Missing public ${model} subtype names`);
  }
  for (const name of names) {
    const own = `Telegram.${model}.${name}`;
    const sdk = `Original.${model}.${name}`;
    cases.push(
      `${model}${name}: Assert<Equal<keyof ${own}, keyof ${sdk}>>;`,
      `${model}${name}Required: Assert<Equal<RequiredKeys<${own}>, RequiredKeys<${sdk}>>>;`,
      `${model}${name}Sdk: Assert<Accepts<${own}, ${sdk}>>;`,
      `${model}${name}Owned: Assert<Accepts<${sdk}, ${own}>>;`
    );
  }
}
const output = await format(
  `// Actual SDK component comparisons; regenerate with generate-bot-component-oracle.mjs.
import type * as Original from '@grammyjs/types';
import type { Telegram } from '../src/index.js';
type Assert<T extends true> = T;
type Equal<A, B> = [A, B] extends [B, A] ? true : false;
type Accepts<Expected, Actual> = [Actual] extends [Expected] ? true : false;
type RequiredKeys<T> = {[K in keyof T]-?: object extends Pick<T, K> ? never : K}[keyof T];
export interface ComponentSubtypeOracle {${cases.join('\n')}}
`,
  { parser: 'typescript', singleQuote: true, trailingComma: 'es5' }
);
const file = new globalThis.URL(
  'experiments/typed-bot-component-oracle.ts',
  root
);
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== output) {
    throw new Error('Stale actual-SDK component oracle');
  }
} else {
  await writeFile(file, output);
}
console.log(
  `Verified ${cases.length / 4} component names with presence and assignment comparisons`
);
