import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const directory = await mkdtemp(join(tmpdir(), 'anygram-framework-clean-'));
const archive = join(directory, 'snapshot.tar');
const deno = process.env.ANYGRAM_DENO_BINARY ?? 'deno';

function run(command, args, cwd = directory, env = process.env) {
  const result = spawnSync(command, args, {
    cwd,
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (result.error) {
    throw result.error;
  }
  return result.status;
}

const source = process.argv[2] ?? 'fbb5a4faba4294b608dc4e6a61e0c6a4d4632cdb';
console.log(JSON.stringify({ directory, source, deno }));
if (
  run('git', ['archive', source, `--output=${archive}`], process.cwd()) ||
  run('tar', ['-xf', archive, '-C', directory]) ||
  run('npm', ['ci', '--ignore-scripts']) ||
  run('npm', [
    'ci',
    '--prefix',
    'experiments/bot-framework-runtime',
    '--ignore-scripts',
  ])
) {
  throw new Error('Clean framework fixture setup failed');
}
const fixture = join(directory, 'experiments/bot-framework-runtime');
const files = ['frameworks', 'limits', 'telegraf'].map(
  (name) => `${name}.integration.js`
);
for (const [mode, cwd, targets] of [
  [
    'root',
    directory,
    files.map((name) => `experiments/bot-framework-runtime/${name}`),
  ],
  ['fixture', fixture, files],
]) {
  const status = run(
    deno,
    [
      'test',
      '--no-config',
      '--node-modules-dir=manual',
      '--allow-read',
      '--allow-env',
      '--allow-net=127.0.0.1',
      ...targets,
    ],
    cwd,
    { ...process.env, DENO_DIR: join(directory, `deno-${mode}`) }
  );
  console.log(JSON.stringify({ mode, status }));
  if (
    (mode === 'root' && status === 0) ||
    (mode === 'fixture' && status !== 0)
  ) {
    throw new Error(`Unexpected clean ${mode} result: ${status}`);
  }
}
