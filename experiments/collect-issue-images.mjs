// Download only images embedded in the archived issue and comment bodies.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
const root = 'docs/case-studies/issue-1/data/issues';
const target = `${root}/images`;
mkdirSync(target, { recursive: true });
const urls = new Map();
const entries = [];
for (const file of readdirSync(root).filter(
  (name) => name.endsWith('.json') && name !== 'inventory.json'
)) {
  const entry = JSON.parse(readFileSync(`${root}/${file}`, 'utf8'));
  entries.push(entry.issue, ...entry.comments);
}
for (const file of readdirSync(`${root}/..`).filter((name) =>
  /^meta-pull-\d+\.json$/.test(name)
)) {
  const entry = JSON.parse(readFileSync(`${root}/../${file}`, 'utf8'));
  entries.push(
    entry.pull,
    ...(entry.comments ?? []),
    ...(entry.inline ?? []),
    ...(entry.reviews ?? [])
  );
}
for (const item of entries) {
  const body = item.body ?? '';
  const patterns = [
    /!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g,
    /<img\b[^>]*?src=["'](https?:\/\/[^"']+)["']/g,
  ];
  for (const pattern of patterns) {
    for (const match of body.matchAll(pattern)) {
      if (!urls.has(match[1])) {
        urls.set(match[1], item.html_url);
      }
    }
  }
}
const token = execFileSync('gh', ['auth', 'token'], {
  encoding: 'utf8',
}).trim();
const results = [];
for (const [url, source] of urls) {
  // This screenshot contains an exposed third-party credential. Never republish it.
  if (url.endsWith('/29389503-4f45-46e6-b52a-197eca6e447b')) {
    results.push({
      url,
      source,
      validImage: false,
      omitted: 'Image contains a third-party bot token',
    });
    continue;
  }
  const name = createHash('sha256').update(url).digest('hex').slice(0, 16);
  const file = `${target}/${name}`;
  try {
    if (!existsSync(file)) {
      execFileSync(
        'curl',
        [
          '--fail',
          '--silent',
          '--show-error',
          '-L',
          '-H',
          `Authorization: token ${token}`,
          '-o',
          file,
          url,
        ],
        { stdio: 'pipe', maxBuffer: 1024 * 1024 }
      );
    }
    const type = execFileSync('file', ['--mime-type', '-b', file], {
      encoding: 'utf8',
    }).trim();
    results.push({
      url,
      source,
      file,
      type,
      validImage: type.startsWith('image/'),
    });
    console.log(`${name}: ${type}`);
  } catch {
    results.push({
      url,
      source,
      file,
      validImage: false,
      error: 'download failed',
    });
    console.log(`${name}: download failed`);
  }
}
writeFileSync(
  `${target}/manifest.json`,
  `${JSON.stringify(results, null, 2)}\n`
);
