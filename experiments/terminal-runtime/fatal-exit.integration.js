import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

for (const mode of ['text', 'visual']) {
  for (const [setting, env, reason] of [
    [
      'token',
      { AUTHORIZED_USER_ID: '8' },
      'BOT_TOKEN environment variable is required',
    ],
    [
      'authorization',
      { BOT_TOKEN: 'startup:fixture' },
      'Either AUTHORIZED_USER_ID or AUTHORIZED_USERNAME must be set',
    ],
  ]) {
    it(
      `flushes real ${mode} fatal startup logs before process exit for missing ${setting}`,
      { timeout: 5000 },
      () => {
        const root = mkdtempSync(join(tmpdir(), 'anygram-terminal-exit-'));
        try {
          const result = spawnSync(
            process.execPath,
            [
              '--max-old-space-size=64',
              '--stack-size=512',
              fileURLToPath(
                new globalThis.URL('fatal-exit-probe.mjs', import.meta.url)
              ),
              mode,
              root,
            ],
            {
              env: { PATH: process.env.PATH, ...env },
              encoding: 'utf8',
              maxBuffer: 65536,
            }
          );
          assert.equal(result.error, undefined);
          assert.equal(result.status, 1);
          const records = readFileSync(join(root, 'logs/bot.log'), 'utf8')
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
          assert.equal(records.at(-1).level, 'fatal');
          assert.equal(records.at(-1).msg, reason);
        } finally {
          rmSync(root, { recursive: true, force: true });
        }
      }
    );
  }
}
