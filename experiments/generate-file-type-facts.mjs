import { readFile, writeFile } from 'node:fs/promises';
import mime from 'mime';

// Extension registrations are factual data; no SDK implementation is shipped.
const target = new globalThis.URL(
  '../src/schema/file-types.json',
  import.meta.url
);
const facts = Object.fromEntries(
  Object.keys(mime._types)
    .sort()
    .map((extension) => [extension, mime.getType(`file.${extension}`)])
);
const text = `${JSON.stringify(facts, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')) !== text) {
    throw new Error('File type facts are stale');
  }
} else {
  await writeFile(target, text);
}
console.log(
  `Verified ${Object.keys(facts).length} registered filename extensions`
);
