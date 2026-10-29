// Immutable downstream source/test evidence for the account workflow audit.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const repository = 'konard/follow';
const commit = 'af8fbb80cec26a7b5b205c93314372d1d92cec1f';
const root = 'docs/case-studies/issue-1/data';
const files = [
  'telegram.lib.mjs',
  'telegram-follow.mjs',
  'telegram-join-group.mjs',
  'experiments/test-private-channel-link-handling.mjs',
  'experiments/test-channel-invalid-error-fix.mjs',
  'experiments/test-telegram-message-reading.mjs',
  'experiments/test-session.mjs',
  'package.json',
  'LICENSE',
];
const sources = [];
for (const file of files) {
  const bytes = execFileSync(
    'gh',
    [
      'api',
      `repos/${repository}/contents/${file}?ref=${commit}`,
      '-H',
      'Accept: application/vnd.github.raw+json',
    ],
    { maxBuffer: 4 * 1024 * 1024 }
  );
  const destination = `${root}/follow-source/${file}`;
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, bytes);
  sources.push({
    file: `follow-source/${file}`,
    url: `https://github.com/${repository}/blob/${commit}/${file}`,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
writeFileSync(
  `${root}/follow-source-manifest.json`,
  `${JSON.stringify(
    {
      repository,
      commit,
      capturedAt: new Date().toISOString(),
      sources,
    },
    null,
    2
  )}\n`
);
console.log(`Captured ${sources.length} downstream sources at ${commit}`);
