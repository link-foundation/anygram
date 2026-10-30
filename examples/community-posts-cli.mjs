#!/usr/bin/env node
import { parseArgs } from 'node:util';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { runCommunityPosts } from './community-posts-runtime.js';
import { usernamePattern } from './community-posts-state.js';
import { FileSessionStore } from '../src/storage.js';
import { terminalPrompt } from './follow-prompt.js';

const help = `Usage: community-posts-cli [options]
  --bot-backend native|grammy|telegraf|node-telegram-bot-api
  --account-backend native|gramjs|teleproto
  --token-file token             Original bot token file
  --channel community_posts     Public channel username
  --state-file .community-posts.json
  --session-file .community-account.session
  --env-file .env               Account API credentials
  --help
`;

export async function runCommunityCli(args, io = {}) {
  const { values } = parseArgs({
    args,
    strict: true,
    options: {
      help: { type: 'boolean', default: false },
      'bot-backend': { type: 'string', default: 'native' },
      'account-backend': { type: 'string', default: 'native' },
      'token-file': { type: 'string', default: 'token' },
      channel: { type: 'string', default: 'community_posts' },
      'state-file': { type: 'string', default: '.community-posts.json' },
      'session-file': { type: 'string', default: '.community-account.session' },
      'env-file': { type: 'string', default: '.env' },
    },
  });
  if (values.help) {
    (io.write ?? ((text) => process.stdout.write(text)))(help);
    return { exitCode: 0 };
  }
  if (
    !['native', 'grammy', 'telegraf', 'node-telegram-bot-api'].includes(
      values['bot-backend']
    ) ||
    !['native', 'gramjs', 'teleproto'].includes(values['account-backend']) ||
    !usernamePattern.test(values.channel)
  ) {
    throw new TypeError('Invalid community backend or channel');
  }
  const options = Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()),
      value,
    ])
  );
  return await runCommunityPosts(options, {
    ...io,
    store:
      io.store ??
      new FileSessionStore(options.stateFile, { maxBytes: 4 * 1024 * 1024 }),
  });
}

async function main() {
  const controller = new globalThis.AbortController();
  const stop = () => controller.abort(new Error('Interrupted'));
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  try {
    await runCommunityCli(process.argv.slice(2), {
      signal: controller.signal,
      prompt: terminalPrompt(process.stdin, process.stderr),
    });
  } catch {
    if (!controller.signal.aborted) {
      process.stderr.write(
        'Community application failed; check credentials, permissions and saved state.\n'
      );
      process.exitCode = 1;
    }
  } finally {
    process.removeListener('SIGINT', stop);
    process.removeListener('SIGTERM', stop);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
