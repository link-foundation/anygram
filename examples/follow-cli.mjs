#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseTelegramLink } from '../src/index.js';
import { createFollowAccount } from './follow-account.js';
import { loadFollowLinks } from './follow-input.js';
import { followArguments } from './follow-cli-arguments.js';
import {
  followAction,
  followExitCode,
  followOutput,
} from './follow-cli-actions.js';
import { terminalPrompt } from './follow-prompt.js';

/** Testable command entry point; help and input validation precede account setup. */
export async function runFollowCli(args, io = {}) {
  const write = io.write ?? ((text) => process.stdout.write(text));
  const { argv, help } = followArguments(args);
  if (help) {
    write(help);
    return { exitCode: 0 };
  }
  const command = argv._[0] ?? 'follow';
  let links;
  if (command === 'follow') {
    links = await loadFollowLinks({
      arguments: argv.links ?? [],
      stdin: io.stdin,
      cachePath: argv.cacheFile,
      signal: io.signal,
    });
  } else if (command === 'join') {
    parseTelegramLink(argv.link);
  }
  const createAccount = io.createAccount ?? createFollowAccount;
  const account = await createAccount({
    backend: argv.backend,
    env: io.env,
    envFile: argv.envFile,
    sessionPath: argv.sessionFile,
    prompt: io.prompt,
    signal: io.signal,
    debug: argv.debug
      ? (event) =>
          (io.writeError ?? ((text) => process.stderr.write(text)))(
            `${JSON.stringify(event)}\n`
          )
      : undefined,
  });
  const result = await account.run((client) =>
    followAction(client, argv, links, io.signal)
  );
  write(followOutput(result, argv));
  return { exitCode: followExitCode(result), result };
}

async function main() {
  const controller = new globalThis.AbortController();
  const interrupt = () => controller.abort(new Error('Interrupted'));
  process.once('SIGINT', interrupt);
  try {
    const { exitCode } = await runFollowCli(process.argv.slice(2), {
      stdin: process.stdin.isTTY ? undefined : process.stdin,
      signal: controller.signal,
      prompt: terminalPrompt(process.stdin, process.stderr),
    });
    process.exitCode = exitCode;
  } catch (error) {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  } finally {
    process.removeListener('SIGINT', interrupt);
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  await main();
}
