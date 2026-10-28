// Run: node experiments/collect-research.mjs. Requires authenticated GitHub CLI.
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const directory = 'docs/case-studies/issue-1/data';
const repositories = [
  'link-foundation/command-stream',
  'link-foundation/meta-sovereign',
  'konard/telegram-bot',
  'konard/follow',
  'konard/telegram-terminal-bot',
  'konard/telegram-community-posts',
  'gram-js/gramjs',
  'sanyok12345/teleproto',
  'mtcute/mtcute',
  'alik0211/mtproto-core',
  'grammyjs/grammY',
  'telegraf/telegraf',
  'yagop/node-telegram-bot-api',
  'BANNERETS/tdl',
  'LonamiWebs/Telethon',
  'pyrogram/pyrogram',
  'tdlib/td',
  'gotd/td',
  'danog/MadelineProto',
];

function api(path) {
  return execFileSync('gh', ['api', path, '--paginate'], {
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

for (const repository of repositories) {
  const name = repository.replace('/', '--');
  for (const [suffix, endpoint] of [
    ['metadata.json', ''],
    ['readme.json', '/readme'],
    [
      'issues.json',
      '/issues?state=open&sort=comments&direction=desc&per_page=10',
    ],
    [
      'recent-prs.json',
      '/pulls?state=closed&sort=updated&direction=desc&per_page=5',
    ],
  ]) {
    try {
      // Single-page rankings have finite size; full comments are fetched below
      // for each selected issue when it is used as a regression requirement.
      const path = endpoint.includes('?')
        ? `repos/${repository}${endpoint}&page=1`
        : `repos/${repository}${endpoint}`;
      const args = endpoint.includes('?')
        ? ['api', path]
        : ['api', path, '--paginate'];
      const result = execFileSync('gh', args, {
        encoding: 'utf8',
        maxBuffer: 32 * 1024 * 1024,
      });
      writeFileSync(`${directory}/${name}-${suffix}`, result);
      if (suffix === 'readme.json') {
        writeFileSync(
          `${directory}/${name}-README.md`,
          Buffer.from(JSON.parse(result).content, 'base64')
        );
      }
      console.log(`${repository}: ${suffix}`);
    } catch (error) {
      writeFileSync(`${directory}/${name}-${suffix}.error.txt`, error.message);
    }
  }
}

writeFileSync(
  `${directory}/collected-at.json`,
  JSON.stringify(
    { collectedAt: new Date().toISOString(), repositories },
    null,
    2
  )
);
// Save the latest feedback alongside the initial issue snapshot.
writeFileSync(
  `${directory}/issue-comments.json`,
  api('repos/link-foundation/anygram/issues/1/comments')
);
