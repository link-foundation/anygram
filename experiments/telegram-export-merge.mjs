import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
const dir = await mkdtemp(join(tmpdir(), 'anygram-telegram-export-'));
try {
  const files = {
    'models.d.ts':
      'export type User = { id: number };\nexport type Message = { id: number };\nexport namespace Message { export type Text = { text: string }; }\n',
    'index.d.ts':
      "import * as Models from './models.js';\nexport declare class Telegram { constructor(token: string); token: string; }\nexport namespace Telegram { export import User = Models.User; export import Message = Models.Message; }\n",
    'fixture.ts':
      "import { Telegram } from './index.js';\nconst api = new Telegram('test');\nconst user: Telegram.User = { id: 1 };\nconst message: Telegram.Message.Text = { text: 'hello' };\nvoid [api.token, user.id, message.text];\n",
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        strict: true,
        noEmit: true,
        types: [],
        target: 'ES2022',
      },
      include: ['*.ts'],
    }),
  };
  for (const [name, content] of Object.entries(files)) {
    await writeFile(join(dir, name), content);
  }
  const result = spawnSync(
    process.execPath,
    ['node_modules/typescript/bin/tsc', '--project', dir],
    { encoding: 'utf8' }
  );
  process.stdout.write(result.stdout ?? '');
  process.stderr.write(result.stderr ?? '');
  process.exitCode = result.status ?? 1;
} finally {
  await rm(dir, { recursive: true, force: true });
}
