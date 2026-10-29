import yargs from 'yargs/yargs';

const followOptions = {
  delay: {
    alias: 'd',
    type: 'number',
    default: 2,
    describe: 'Seconds between links (0–3600)',
  },
  mute: { alias: 'm', type: 'boolean', default: false },
  archive: { alias: 'a', type: 'boolean', default: false },
  'skip-rate-limit': { alias: 's', type: 'boolean', default: false },
};

export function followArguments(args) {
  let parsed;
  let failure;
  let rendered;
  yargs(args)
    .scriptName('follow-cli')
    .exitProcess(false)
    .version(false)
    .strict()
    .parserConfiguration({
      'parse-numbers': false,
      'parse-positional-numbers': false,
    })
    .option('backend', {
      choices: ['native', 'gramjs', 'teleproto'],
      default: 'native',
    })
    .option('env-file', {
      type: 'string',
      describe: 'Existing plaintext follow .env file',
    })
    .option('session-file', {
      type: 'string',
      describe: 'Portable session destination',
    })
    .option('cache-file', { type: 'string', describe: 'Links Notation cache' })
    .option('verbose', { alias: 'v', type: 'boolean', default: false })
    .option('json', { alias: 'j', type: 'boolean', default: false })
    .option('debug', { type: 'boolean', default: false })
    .command(
      '$0 [links..]',
      'Follow links, stdin, or the existing follow cache',
      followOptions
    )
    .command(
      'follow [links..]',
      'Follow links, stdin, or cached links',
      followOptions
    )
    .command('join <link>', 'Join one group with optional details', {
      link: { type: 'string' },
      info: { alias: 'i', type: 'boolean', default: false },
      messages: { alias: 'm', type: 'boolean', default: false },
    })
    .command('list', 'List all joined groups and channels')
    .command('leave <group>', 'Leave by link, username, or exact marked ID', {
      group: { type: 'string' },
    })
    .help()
    .parse(args, (error, argv, output) => {
      failure = error;
      parsed = argv;
      rendered = output;
    });
  if (failure) {
    throw failure;
  }
  if (
    parsed.delay !== undefined &&
    (!Number.isFinite(parsed.delay) || parsed.delay < 0 || parsed.delay > 3600)
  ) {
    throw new RangeError('Delay must be from 0 to 3600 seconds');
  }
  return { argv: parsed, help: parsed.help ? rendered : undefined };
}
