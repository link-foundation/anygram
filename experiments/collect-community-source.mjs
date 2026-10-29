import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const repository = 'konard/telegram-community-posts';
const commit = '29e3fe630d3703aedded040ef4bdd554dc0f0be9';
const directory = new globalThis.URL(
  '../docs/case-studies/issue-1/data/',
  import.meta.url
);
const files = [
  ['.gitignore', 'community-posts-gitignore.txt'],
  ['LICENSE', 'community-posts-LICENSE.txt'],
  ['README.md', 'community-posts-README.md'],
  ['index.js', 'community-posts-index.js'],
  ['package.json', 'community-posts-package.json'],
  ['package-lock.json', 'community-posts-package-lock.json'],
];
const manifest = [];
for (const [path, archive] of files) {
  const response = JSON.parse(
    execFileSync(
      'gh',
      ['api', `repos/${repository}/contents/${path}?ref=${commit}`],
      { maxBuffer: 1024 * 1024 }
    ).toString()
  );
  const bytes = Buffer.from(response.content, 'base64');
  if (
    response.encoding !== 'base64' ||
    bytes.length !== response.size ||
    bytes.length > 128 * 1024
  ) {
    throw new Error(`Invalid bounded source response for ${path}`);
  }
  await writeFile(new globalThis.URL(archive, directory), bytes);
  manifest.push({
    path,
    archive,
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
await writeFile(
  new globalThis.URL('community-posts-source-manifest.json', directory),
  `${JSON.stringify({ repository, commit, files: manifest }, null, 2)}\n`
);
