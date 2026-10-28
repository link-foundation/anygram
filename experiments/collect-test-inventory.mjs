// Snapshot source trees to compare test scope without claiming coverage from counts.
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const root = 'docs/case-studies/issue-1/data';
const repositories = JSON.parse(
  readFileSync(`${root}/collected-at.json`, 'utf8')
).repositories;
const results = [];
for (const repository of repositories) {
  const metadata = JSON.parse(
    readFileSync(
      `${root}/${repository.replace('/', '--')}-metadata.json`,
      'utf8'
    )
  );
  const tree = JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        `repos/${repository}/git/trees/${metadata.default_branch}?recursive=1`,
      ],
      { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }
    )
  );
  const paths = tree.tree.filter((x) => x.type === 'blob').map((x) => x.path);
  const tests = paths.filter((x) =>
    /(^|\/)(__tests__|tests?|spec)(\/|[._-])|\.(test|spec)\.[^.]+$|_test\.(go|py|cpp|cc|c|h|rs)$|Test\.php$/.test(
      x
    )
  );
  results.push({
    repository,
    commit: tree.sha,
    truncated: tree.truncated,
    capturedAt: new Date().toISOString(),
    sourceFiles: paths.length,
    testPaths: tests,
  });
  console.log(
    `${repository}: ${tests.length} test-related paths, tree truncated=${tree.truncated}`
  );
}
writeFileSync(
  `${root}/test-inventory.json`,
  `${JSON.stringify(results, null, 2)}\n`
);
