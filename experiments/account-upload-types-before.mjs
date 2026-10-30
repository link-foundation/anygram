import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new globalThis.URL('../', import.meta.url));
const snapshot = await mkdtemp(join(tmpdir(), 'anygram-upload-types-before-'));
const commit = '721e68851301efad2da6d8ea2cddc55e81d8c91b';
try {
  const paths = execFileSync(
    'git',
    ['ls-tree', '-r', '--name-only', commit, 'src'],
    { cwd: root, encoding: 'utf8' }
  )
    .trim()
    .split('\n');
  for (const path of paths.filter((name) => name.endsWith('.d.ts'))) {
    await mkdir(dirname(join(snapshot, path)), { recursive: true });
    await writeFile(
      join(snapshot, path),
      execFileSync('git', ['show', `${commit}:${path}`], {
        cwd: root,
        maxBuffer: 16 * 1024 * 1024,
      })
    );
  }
  await cp(
    join(root, 'examples/typed-account-upload.ts'),
    join(snapshot, 'example.ts')
  );
  const example = await import('node:fs/promises').then((fs) =>
    fs.readFile(join(snapshot, 'example.ts'), 'utf8')
  );
  await writeFile(
    join(snapshot, 'example.ts'),
    example
      .split('export async function checkUploadTypes')[0]
      .replace('../src/index.js', './src/index.js')
  );
  await writeFile(join(snapshot, 'package.json'), '{"type":"module"}');
  await writeFile(
    join(snapshot, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        target: 'ES2022',
        module: 'NodeNext',
        moduleResolution: 'NodeNext',
        strict: true,
        noEmit: true,
        types: [],
      },
      include: ['src/**/*.d.ts', 'example.ts'],
    })
  );
  const result = spawnSync(
    process.execPath,
    [
      join(root, 'node_modules/typescript/bin/tsc'),
      '--project',
      join(snapshot, 'tsconfig.json'),
    ],
    { encoding: 'utf8', maxBuffer: 1024 * 1024 }
  );
  assert.equal(result.error, undefined);
  assert.equal(result.signal, null);
  console.log(result.stdout);
  console.log(result.stderr);
  assert([1, 2].includes(result.status));
  assert.match(result.stdout, /CustomFile/);
  assert.match(result.stdout, /uploadFile/);
} finally {
  await rm(snapshot, { recursive: true, force: true });
}
