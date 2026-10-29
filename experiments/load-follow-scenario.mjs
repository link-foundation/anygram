import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const root = new globalThis.URL(
  '../docs/case-studies/issue-1/data/',
  import.meta.url
);

/** Execute only the pinned application class, excluding imports and CLI startup. */
export function loadFollowScenario(name, bridge) {
  const file = {
    TelegramFollower: 'telegram-follow.mjs',
    TelegramGroupJoiner: 'telegram-join-group.mjs',
  }[name];
  if (!file) {
    throw new TypeError('Unknown pinned follow scenario');
  }
  const manifest = JSON.parse(
    readFileSync(
      new globalThis.URL('follow-source-manifest.json', root),
      'utf8'
    )
  );
  const entry = manifest.sources.find(
    (item) => item.file === `follow-source/${file}`
  );
  const bytes = readFileSync(new globalThis.URL(entry.file, root));
  if (
    bytes.length > 128 * 1024 ||
    createHash('sha256').update(bytes).digest('hex') !== entry.sha256
  ) {
    throw new Error('Pinned follow source differs from its immutable manifest');
  }
  const source = bytes.toString('utf8');
  const begin = source.indexOf(`class ${name} {`);
  const end = source.indexOf(
    name === 'TelegramFollower' ? '\nyargs(' : '\nconst argv ='
  );
  if (begin < 0 || end <= begin) {
    throw new Error('Pinned follow application class boundaries changed');
  }
  const Constructor = new Function(
    'TelegramUserClient',
    'console',
    `'use strict';\n${source.slice(begin, end)}\nreturn ${name};`
  )(
    class {
      constructor() {
        return bridge;
      }
    },
    { log() {}, error() {} }
  );
  const scenario = new Constructor();
  // Bound fixtures omit only application pacing; the business logic is unchanged.
  if (name === 'TelegramFollower') {
    let pauses = 0;
    scenario.sleep = () => {
      if (++pauses > 100) {
        throw new RangeError('Pinned follow fixture pacing budget exceeded');
      }
      return Promise.resolve();
    };
  }
  return scenario;
}
