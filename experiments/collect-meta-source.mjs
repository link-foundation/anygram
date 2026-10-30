// Capture Telegram modules and their tests at one immutable upstream commit.
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { writeFileSync } from 'node:fs';
import { sanitizeResearch } from './research-redaction.mjs';
const run = promisify(execFile);
const repository = 'link-foundation/meta-sovereign';
const root = 'docs/case-studies/issue-1/data';
const api = async (path) =>
  JSON.parse(
    (await run('gh', ['api', path], { maxBuffer: 32 * 1024 * 1024 })).stdout
  );
const tree = await api(`repos/${repository}/git/trees/main?recursive=1`);
if (tree.truncated) {
  throw new Error('Source tree is truncated');
}
const files = tree.tree.filter(
  (x) =>
    x.type === 'blob' && x.path.includes('telegram') && x.path.endsWith('.js')
);
const captured = new Array(files.length);
let next = 0;
async function worker() {
  while (next < files.length) {
    const index = next++;
    const file = files[index];
    const blob = await api(`repos/${repository}/git/blobs/${file.sha}`);
    captured[index] = {
      path: file.path,
      sha: file.sha,
      content: sanitizeResearch(
        Buffer.from(blob.content, 'base64').toString('utf8')
      ),
    };
    console.log(file.path);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));
writeFileSync(
  `${root}/meta-telegram-source.json`,
  `${JSON.stringify(
    {
      repository,
      commit: tree.sha,
      capturedAt: new Date().toISOString(),
      files: captured,
    },
    null,
    2
  )}\n`
);
const inventory = captured.map(({ path, content }) => ({
  path,
  constructors: [
    ...new Set(
      [...content.matchAll(/\bApi\.([A-Za-z_]+)\.([A-Za-z_]+)/g)].map(
        (m) => `${m[1]}.${m[2]}`
      )
    ),
  ].sort(),
  operations: [
    ...new Set(
      [...content.matchAll(/\bclient\.([A-Za-z_]+)\s*\(/g)].map((m) => m[1])
    ),
  ].sort(),
  invokes: [...content.matchAll(/\.invoke\s*\(/g)].length,
}));
writeFileSync(
  `${root}/meta-telegram-api-inventory.json`,
  `${JSON.stringify(inventory, null, 2)}\n`
);
