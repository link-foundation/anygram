// Run with an optional captured TL Markdown path to rebuild without network access.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { readResponseBytes } from '../src/http.js';

const source = 'https://core.telegram.org/schema/end-to-end.md';
async function download() {
  const response = await fetch(source, {
    signal: globalThis.AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    throw new Error(`Secret schema download failed: ${response.status}`);
  }
  return Buffer.from(
    await readResponseBytes(response, { maxBytes: 1024 * 1024 })
  );
}
const bytes = process.argv[2]
  ? readFileSync(process.argv[2])
  : await download();
const constructors = [];
let layer = 0;
for (const line of bytes.toString('utf8').split('\n')) {
  const marker = /^===(\d+)===$/.exec(line.trim());
  if (marker) {
    layer = Number(marker[1]);
  }
  const match = /^(\w+)#([a-f0-9]+)\s+(.*?)\s*=\s*(\w+);/.exec(line);
  if (!match) {
    continue;
  }
  constructors.push({
    id: String(parseInt(match[2], 16)),
    predicate: match[1],
    params: [...match[3].matchAll(/(\w+):([\w.!?#<>]+)/g)].map((field) => ({
      name: field[1],
      type: field[2],
    })),
    type: match[4],
    layer,
  });
}
if (!constructors.length || constructors.some((item) => item.layer < 8)) {
  throw new TypeError('Invalid versioned secret-chat schema');
}
const registry = {
  layer: Math.max(...constructors.map((item) => item.layer)),
  source,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  constructors,
  methods: [],
};
writeFileSync('src/schema/secret.json', `${JSON.stringify(registry)}\n`);
console.log(
  `Secret schema through layer ${registry.layer}: ${registry.constructors.length} constructor versions`
);
