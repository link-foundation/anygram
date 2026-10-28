// Complete historical bot reports and recent downstream implementation context.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { sanitizeResearch } from './research-redaction.mjs';

const root = 'docs/case-studies/issue-1/data';
function api(path, paginate = false) {
  const args = ['api', path, ...(paginate ? ['--paginate', '--slurp'] : [])];
  const result = JSON.parse(
    execFileSync('gh', args, {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    })
  );
  return paginate ? result.flat() : result;
}
function save(path, data) {
  writeFileSync(
    `${root}/${path}`,
    `${JSON.stringify(sanitizeResearch(data), null, 2)}\n`
  );
}
const inventory = JSON.parse(
  readFileSync(`${root}/issues/inventory.json`, 'utf8')
);
const repository = 'yagop/node-telegram-bot-api';
for (const number of [550, 1136, 1161]) {
  const issue = api(`repos/${repository}/issues/${number}`);
  const comments = api(`repos/${repository}/issues/${number}/comments`, true);
  const file = `${repository.replace('/', '--')}-${number}.json`;
  save(`issues/${file}`, {
    repository,
    issue,
    comments,
    capturedAt: new Date().toISOString(),
  });
  const entry = {
    repository,
    number,
    title: issue.title,
    comments: comments.length,
    selection:
      'Highest-comment closed reports; open ranking contained no actual issues',
    file,
  };
  const index = inventory.findIndex(
    (x) => x.repository === repository && x.number === number
  );
  if (index < 0) {
    inventory.push(entry);
  } else {
    inventory[index] = entry;
  }
  console.log(`${repository}#${number}: ${comments.length} comments`);
}
save('issues/inventory.json', inventory);

for (const number of [36, 34, 28, 17]) {
  const prefix = `repos/link-foundation/meta-sovereign`;
  const pull = api(`${prefix}/pulls/${number}`);
  const feedback =
    number === 36 || number === 34
      ? {
          comments: api(`${prefix}/issues/${number}/comments`, true),
          inline: api(`${prefix}/pulls/${number}/comments`, true),
          reviews: api(`${prefix}/pulls/${number}/reviews`, true),
        }
      : {};
  save(`meta-pull-${number}.json`, {
    pull,
    ...feedback,
    capturedAt: new Date().toISOString(),
  });
  console.log(`meta-sovereign#${number}: ${pull.title}`);
}
