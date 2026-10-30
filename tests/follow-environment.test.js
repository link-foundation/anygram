import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  readFile,
  writeFile,
  rm,
  stat,
  readdir,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEnv } from 'node:util';
import { Session } from '../src/index.js';

const environment = () => import('../examples/follow-environment.js');
const session = (byte) =>
  new Session({ dc: 2, authKey: Buffer.alloc(256, byte) }).save('gramjs');
async function temporary(task) {
  const directory = await mkdtemp(join(tmpdir(), 'anygram-follow-env-'));
  try {
    await task(directory);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

it('atomically creates a private legacy environment session and loads it unchanged', async () => {
  const { FollowEnvironmentSessionStore } = await environment();
  await temporary(async (directory) => {
    const path = join(directory, 'nested', '.env');
    const store = new FollowEnvironmentSessionStore(path);
    assert.equal(await store.load(), '');
    await store.save(session(1));
    assert.equal(await store.load(), session(1));
    assert.equal(
      parseEnv(await readFile(path, 'utf8')).TELEGRAM_USER_SESSION,
      session(1)
    );
    if (process.platform !== 'win32') {
      assert.equal((await stat(path)).mode & 0o777, 0o600);
    }
    assert.deepEqual(await readdir(join(directory, 'nested')), ['.env']);
  });
});

it('replaces every real session assignment while preserving unrelated multiline values and comments', async () => {
  const { FollowEnvironmentSessionStore } = await environment();
  await temporary(async (directory) => {
    const path = join(directory, '.env');
    const untouched =
      '# retained\r\nOTHER="first\r\nTELEGRAM_USER_SESSION=inside-quotes\r\nlast"\r\nTOKEN=secret#comment\r\n';
    await writeFile(
      path,
      `${untouched}export TELEGRAM_USER_SESSION = 'old' # replaced\r\nTELEGRAM_USER_SESSION=older\r\nLAST=yes`
    );
    const store = new FollowEnvironmentSessionStore(path);
    await store.save(session(2));
    const text = await readFile(path, 'utf8');
    assert(text.startsWith(untouched));
    assert(text.endsWith('LAST=yes'));
    assert(!text.includes('older'));
    const parsed = parseEnv(text);
    assert.equal(
      parsed.OTHER,
      'first\nTELEGRAM_USER_SESSION=inside-quotes\nlast'
    );
    assert.equal(parsed.TELEGRAM_USER_SESSION, session(2));
    assert.equal(parsed.LAST, 'yes');
    assert.equal(parsed.TOKEN, 'secret');
  });
});

it('serializes session replacements and preserves unrelated changes made before each save', async () => {
  const { FollowEnvironmentSessionStore } = await environment();
  await temporary(async (directory) => {
    const path = join(directory, '.env');
    const store = new FollowEnvironmentSessionStore(path);
    await Promise.all([store.save(session(3)), store.save(session(4))]);
    assert.equal(await store.load(), session(4));
    await writeFile(path, `${await readFile(path, 'utf8')}ADDED=kept\n`);
    await store.save(session(5));
    assert.equal(parseEnv(await readFile(path, 'utf8')).ADDED, 'kept');
    assert.equal(await store.load(), session(5));
  });
});

it('rejects invalid sessions and bounded configuration overflow without altering the file', async () => {
  const { FollowEnvironmentSessionStore } = await environment();
  await temporary(async (directory) => {
    const path = join(directory, '.env');
    const original = '# keep\n';
    await writeFile(path, original);
    const store = new FollowEnvironmentSessionStore(path);
    for (const value of [
      '',
      'not a session',
      '1\nINJECTED=yes',
      'x'.repeat(8193),
    ]) {
      await assert.rejects(store.save(value));
      assert.equal(await readFile(path, 'utf8'), original);
    }
    const oversized = 'X'.repeat(256 * 1024 + 1);
    await writeFile(path, oversized);
    await assert.rejects(store.load(), /256 KiB/);
    await assert.rejects(store.save(session(6)), /256 KiB/);
    assert.equal(await readFile(path, 'utf8'), oversized);
    await writeFile(path, `#${'x'.repeat(256 * 1024 - 2)}\n`);
    await assert.rejects(store.save(session(6)), /256 KiB/);
  });
});

it('skips single/backtick quoted multiline bindings and keeps escaped-quote semantics unchanged', async () => {
  const { FollowEnvironmentSessionStore } = await environment();
  await temporary(async (directory) => {
    const path = join(directory, '.env');
    const original =
      'SINGLE=\'one\nTELEGRAM_USER_SESSION=quoted\nend\'\nBACK=`two\nTELEGRAM_USER_SESSION=quoted\nend`\nESCAPED="first\\"last"\nAFTER=yes\n';
    await writeFile(path, original);
    const store = new FollowEnvironmentSessionStore(path);
    await store.save(session(7));
    const text = await readFile(path, 'utf8');
    assert(text.startsWith(original));
    const { TELEGRAM_USER_SESSION, ...values } = parseEnv(text);
    assert.equal(TELEGRAM_USER_SESSION, session(7));
    assert.deepEqual(values, { ...parseEnv(original) });
  });
});

it('does not swallow environment read/write failures and can recover its save queue', async () => {
  const { FollowEnvironmentSessionStore } = await environment();
  await temporary(async (directory) => {
    const path = join(directory, 'blocker');
    await writeFile(path, 'not a directory');
    const store = new FollowEnvironmentSessionStore(join(path, '.env'));
    // Windows reports ENOENT for a child of a regular file; use an existing
    // directory to reproduce a read error consistently on every platform.
    await assert.rejects(new FollowEnvironmentSessionStore(directory).load());
    await assert.rejects(store.save(session(8)));
    await rm(path);
    await store.save(session(9));
    assert.equal(await store.load(), session(9));
  });
});
