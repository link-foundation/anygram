// Archive every comment on the three highest-comment non-PR reports per client.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { sanitizeResearch } from './research-redaction.mjs';
const root = 'docs/case-studies/issue-1/data';
const repositories = JSON.parse(
  readFileSync(`${root}/collected-at.json`, 'utf8')
).repositories.slice(6);
mkdirSync(`${root}/issues`, { recursive: true });
const inventory = [];
for (const repo of repositories) {
  const ranking = JSON.parse(
    readFileSync(`${root}/${repo.replace('/', '--')}-issues.json`, 'utf8')
  );
  for (const issue of ranking
    .filter((item) => !item.pull_request)
    .slice(0, 3)) {
    const comments = execFileSync(
      'gh',
      [
        'api',
        `repos/${repo}/issues/${issue.number}/comments`,
        '--paginate',
        '--slurp',
      ],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    );
    const entry = {
      repository: repo,
      issue,
      comments: JSON.parse(comments).flat(),
      capturedAt: new Date().toISOString(),
    };
    const filename = `${repo.replace('/', '--')}-${issue.number}.json`;
    writeFileSync(
      `${root}/issues/${filename}`,
      `${JSON.stringify(sanitizeResearch(entry), null, 2)}\n`
    );
    inventory.push({
      repository: repo,
      number: issue.number,
      title: issue.title,
      comments: entry.comments.length,
      file: filename,
    });
    console.log(`${repo}#${issue.number}: ${entry.comments.length} comments`);
  }
}
writeFileSync(
  `${root}/issues/inventory.json`,
  `${JSON.stringify(inventory, null, 2)}\n`
);
