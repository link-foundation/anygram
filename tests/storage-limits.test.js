import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import * as storage from '../src/storage.js';
import { createFollowAccount } from '../examples/follow-account.js';
import TelegramUserClient from '../examples/telegram-user-client.js';

async function temporary(task) {
  const directory = await mkdtemp(join(tmpdir(), 'anygram-storage-limits-'));
  try {
    await task(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

it('bounds session reads and writes by UTF-8 bytes and retains the prior file on overflow', async () => {
  await temporary(async (directory) => {
    const path = join(directory, 'session');
    const store = new storage.FileSessionStore(path, { maxBytes: 6 });
    await store.save('界界');
    assert.equal(await store.load(), '界界');
    await assert.rejects(store.save('界界x'), /6 bytes/);
    assert.equal(await readFile(path, 'utf8'), '界界');
    await writeFile(path, '界界x');
    await assert.rejects(store.load(), /6 bytes/);
    assert.deepEqual(await readdir(directory), ['session']);
  });
});

it('assembles bounded file chunks before decoding split UTF-8 characters', async () => {
  assert.equal(typeof storage.readTextFile, 'function');
  await temporary(async (directory) => {
    const path = join(directory, 'text');
    const text = `${'a'.repeat(65535)}界${'b'.repeat(4096)}`;
    await writeFile(path, text);
    assert.equal(
      await storage.readTextFile(path, { maxBytes: Buffer.byteLength(text) }),
      text
    );
    assert.equal(await storage.readTextFile(path), text);
    await writeFile(path, '');
    assert.equal(await storage.readTextFile(path), '');
  });
});

it('rejects bounded file overflow and cancellation before opening a missing path', async () => {
  assert.equal(typeof storage.readTextFile, 'function');
  await temporary(async (directory) => {
    const path = join(directory, 'text');
    await writeFile(path, '1234567');
    await assert.rejects(
      storage.readTextFile(path, { maxBytes: 6 }),
      /6 bytes/
    );
    const controller = new globalThis.AbortController();
    const reason = Object.assign(new Error('cancel bounded read'), {
      code: 'ENOENT',
    });
    controller.abort(reason);
    await assert.rejects(
      storage.readTextFile(join(directory, 'missing'), {
        signal: controller.signal,
      }),
      (error) => error === reason
    );
    const store = new storage.FileSessionStore(join(directory, 'missing'));
    await assert.rejects(
      store.load({ signal: controller.signal }),
      (error) => error === reason
    );
  });
});

it('validates finite allocation limits before opening or writing a file', async () => {
  assert.equal(typeof storage.readTextFile, 'function');
  for (const maxBytes of [
    0,
    -1,
    1.5,
    NaN,
    Infinity,
    16 * 1024 * 1024 + 1,
    '6',
  ]) {
    assert.throws(
      () => new storage.FileSessionStore('unused', { maxBytes }),
      /limit/i
    );
    await assert.rejects(
      storage.readTextFile('unused', { maxBytes }),
      /limit/i
    );
  }
});

it('rejects non-text saves without losing the queued writer or creating a file', async () => {
  await temporary(async (directory) => {
    const store = new storage.FileSessionStore(join(directory, 'session'));
    for (const value of [undefined, null, {}, Buffer.from('binary'), 7]) {
      await assert.rejects(store.save(value), /string/);
    }
    assert.deepEqual(await readdir(directory), []);
    await store.save('recovered');
    assert.equal(await store.load(), 'recovered');
  });
});

it('keeps missing files empty and propagates other filesystem read errors', async () => {
  await temporary(async (directory) => {
    assert.equal(
      await new storage.FileSessionStore(join(directory, 'missing')).load(),
      ''
    );
    await assert.rejects(new storage.FileSessionStore(directory).load());
  });
});

it('limits standalone and command account session imports to 8 KiB before native construction', async () => {
  await temporary(async (directory) => {
    const sessionPath = join(directory, 'session');
    await writeFile(sessionPath, 'x'.repeat(8193));
    await assert.rejects(
      createFollowAccount({
        envFile: false,
        sessionPath,
        env: {
          TELEGRAM_USER_BOT_API_ID: '777',
          TELEGRAM_USER_BOT_API_HASH: 'a'.repeat(32),
        },
      }),
      /8 KiB/
    );
    const legacy = new TelegramUserClient({
      apiId: 777,
      apiHash: 'a'.repeat(32),
      envFile: false,
      env: {},
      sessionPath,
    });
    await assert.rejects(legacy.connect(), /8 KiB/);
    await legacy.disconnect();
  });
});
