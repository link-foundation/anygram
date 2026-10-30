import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileSessionStore } from '../src/storage.js';
it('persists sessions atomically and serializes concurrent saves', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anygram-session-'));
  try {
    const store = new FileSessionStore(join(directory, 'account.session'));
    assert.equal(await store.load(), '');
    await Promise.all([store.save('first'), store.save('second')]);
    assert.equal(await new FileSessionStore(store.path).load(), 'second');
    assert.deepEqual(await readdir(directory), ['account.session']);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
