import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { format } from 'prettier';

const root = new globalThis.URL('../', import.meta.url);
const facts = JSON.parse(
  await readFile(
    new globalThis.URL(
      'docs/case-studies/issue-1/data/bot-api/subtype-facts.json',
      root
    )
  )
);
const sdk = await readFile(new globalThis.URL(facts.source, root), 'utf8');
if (createHash('sha256').update(sdk).digest('hex') !== facts.sha256) {
  throw new Error('Unreviewed SDK subtype source');
}
const namespace = sdk
  .split('export declare namespace Message {')[1]
  .split('\n}')[0];
const names = [...namespace.matchAll(/^ {4}(?:interface|type) (\w+)/gm)].map(
  (match) => match[1]
);
const expected = [...Object.keys(facts.bases), ...Object.keys(facts.aliases)];
if (JSON.stringify(names) !== JSON.stringify(expected)) {
  throw new Error('Missing SDK message subtype names');
}
const cases = names.map(
  (name) =>
    `${name}: Assert<Equal<keyof Telegram.Message.${name}, keyof Original.Message.${name}>>;\n${name}Required: Assert<Equal<RequiredKeys<Telegram.Message.${name}>, RequiredKeys<Original.Message.${name}>>>;`
);
const source = `// Actual SDK field-presence comparisons; regenerate with generate-bot-subtype-oracle.mjs.
import type * as Original from '@grammyjs/types';
import type { Telegram } from '../src/index.js';
type Assert<T extends true> = T;
type Equal<A, B> = [A, B] extends [B, A] ? true : false;
type RequiredKeys<T> = {[K in keyof T]-?: object extends Pick<T, K> ? never : K}[keyof T];
export interface MessageSubtypeOracle {${cases.join('\n')}}
`;
const output = await format(source, {
  parser: 'typescript',
  singleQuote: true,
  trailingComma: 'es5',
});
const file = new globalThis.URL(
  'experiments/typed-bot-subtype-oracle.ts',
  root
);
if (process.argv.includes('--check')) {
  if ((await readFile(file, 'utf8')) !== output) {
    throw new Error('Stale actual-SDK message subtype oracle');
  }
} else {
  await writeFile(file, output);
}
console.log(
  `Verified ${names.length} public message namespace names with required/optional field comparisons`
);
