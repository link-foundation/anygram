import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const repository = 'konard/telegram-terminal-bot';
const commit = '7f3aeee50965160b31dca62b6e5b4e4a7af99bea';
const root = 'docs/case-studies/issue-1/data';
const api = (...args) =>
  execFileSync('gh', ['api', ...args], { maxBuffer: 4 * 1024 * 1024 });
const tree = JSON.parse(
  api(`repos/${repository}/git/trees/${commit}?recursive=1`)
);
if (tree.truncated) {
  throw new Error('Terminal source tree is incomplete');
}
const files = tree.tree.filter(
  (item) =>
    item.type === 'blob' &&
    (/^src\/.+\.js$/.test(item.path) ||
      ['README.md', 'LICENSE', 'package.json', '.env.example'].includes(
        item.path
      ))
);
if (files.length > 32 || files.some((item) => item.size > 256 * 1024)) {
  throw new RangeError('Terminal archive exceeds its finite collection budget');
}
const sources = [];
for (const item of files) {
  const bytes = api(
    `repos/${repository}/contents/${item.path}?ref=${commit}`,
    '-H',
    'Accept: application/vnd.github.raw+json'
  );
  if (bytes.length !== item.size) {
    throw new Error(`Incomplete terminal source: ${item.path}`);
  }
  const file = `terminal-source/${item.path}`;
  mkdirSync(dirname(`${root}/${file}`), { recursive: true });
  writeFileSync(`${root}/${file}`, bytes);
  sources.push({
    file,
    bytes: bytes.length,
    gitBlob: item.sha,
    sha256: createHash('sha256').update(bytes).digest('hex'),
    url: `https://github.com/${repository}/blob/${commit}/${item.path}`,
  });
}
writeFileSync(
  `${root}/terminal-source-manifest.json`,
  `${JSON.stringify({ repository, commit, sources }, null, 2)}\n`
);
console.log(
  `Captured ${sources.length} complete terminal sources at ${commit}`
);
