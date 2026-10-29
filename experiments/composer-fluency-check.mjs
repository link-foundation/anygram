import { execFileSync, spawnSync } from 'node:child_process';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new globalThis.URL('../', import.meta.url));
const modes = {
  '--filters': [
    'typed-filter-narrowing.ts',
    '4d6c1ca33b62a06500312a106e2638a9f80b66d0',
  ],
  '--models': [
    'typed-bot-models.ts',
    'baa796927da5cc69ea00040e00c3936c25e4ea60',
  ],
  default: [
    'typed-composer-fluency.ts',
    '84328a107c89a8b4cbd7eddd67dfdb2444603688',
  ],
};
const mode =
  Object.keys(modes).find((key) => process.argv.includes(key)) ?? 'default';
const [fixture, revision] = modes[mode];
const frozen = new Set([
  'src/index.d.ts',
  'src/telegraf-composer.d.ts',
  ...(mode === '--filters' ? ['src/bot-context-checkers.d.ts'] : []),
]);
const before = process.argv.includes('--before');
const workspace = await mkdtemp(join(tmpdir(), 'anygram-fluency-'));

async function declarations(relative) {
  await mkdir(join(workspace, relative), { recursive: true });
  for (const entry of await readdir(join(root, relative), {
    withFileTypes: true,
  })) {
    const path = `${relative}/${entry.name}`;
    if (entry.isDirectory()) {
      await declarations(path);
    } else if (entry.name.endsWith('.d.ts')) {
      const content =
        before && frozen.has(path)
          ? execFileSync('git', ['show', `${revision}:${path}`], {
              cwd: root,
              maxBuffer: 128 * 1024,
            })
          : await readFile(join(root, path));
      await writeFile(join(workspace, path), content);
    }
  }
}

try {
  await declarations('src');
  await mkdir(join(workspace, 'examples'));
  await writeFile(
    join(workspace, 'examples', fixture),
    await readFile(join(root, 'examples', fixture))
  );
  await writeFile(join(workspace, 'package.json'), '{"type":"module"}\n');
  await writeFile(
    join(workspace, 'tsconfig.json'),
    await readFile(join(root, 'tsconfig.json'))
  );
  const result = spawnSync(
    process.execPath,
    [join(root, 'node_modules/typescript/bin/tsc'), '--project', workspace],
    { encoding: 'utf8', maxBuffer: 256 * 1024 }
  );
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  if (result.error) {
    throw result.error;
  }
  process.exitCode = result.status ?? 1;
} finally {
  await rm(workspace, { recursive: true, force: true });
}
