// Verify captured bytes survive Git's Windows-style text checkout settings.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import registry from '../src/schema/secret.json' with { type: 'json' };

export function verifyArchiveCheckout() {
  const directory = mkdtempSync(join(tmpdir(), 'anygram-archive-'));
  const path = 'docs/case-studies/issue-1/data/secret-schema.md';
  try {
    const result = spawnSync(
      'git',
      [
        '-c',
        'core.autocrlf=true',
        '-c',
        'core.eol=crlf',
        'checkout-index',
        `--prefix=${directory.replaceAll('\\', '/')}/`,
        '--',
        path,
      ],
      { encoding: 'utf8', maxBuffer: 128 * 1024, windowsHide: true }
    );
    assert.equal(result.status, 0, result.stderr || result.error?.message);
    const bytes = readFileSync(join(directory, path));
    const digest = createHash('sha256').update(bytes).digest('hex');
    assert.equal(
      digest,
      registry.sha256,
      'Git checkout changed the captured source bytes'
    );
    return digest;
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}
