import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { constants } from 'node:fs';
import { mkdtemp, open, readdir, readlink, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { performance } from 'node:perf_hooks';
import { setTimeout as delay } from 'node:timers/promises';
import { BotApi } from '../src/bot-api.js';
import { Anygram, createAdapter, InputFile } from '../src/index.js';

if (process.platform !== 'linux') {
  throw new Error('This bounded filesystem probe requires Linux FIFO/procfs');
}
const root = await mkdtemp(join(tmpdir(), 'anygram-blocked-file-'));
const path = join(root, 'blocked.fifo');
execFileSync('mkfifo', ['-m', '600', path], { maxBuffer: 4096 });
// Pair the blocked read-only open after a finite delay, even if an assertion fails.
const watchdog = globalThis.setTimeout(() => process.exit(1), 5000);
let releaseStarted = false;
const released = delay(250).then(async () => {
  releaseStarted = true;
  for (let attempt = 0; attempt < 50; attempt++) {
    try {
      const writer = await open(
        path,
        constants.O_WRONLY | constants.O_NONBLOCK
      );
      await writer.close();
      return;
    } catch (error) {
      if (error.code !== 'ENXIO') {
        throw error;
      }
      await delay(10);
    }
  }
  throw new Error('Bounded FIFO writer could not pair the pending file open');
});
try {
  const mode = process.argv[2] ?? 'bot';
  assert(['bot', 'account', 'account-input'].includes(mode));
  const upload =
    mode === 'bot'
      ? () =>
          new BotApi({
            token: 'blocked:fixture',
            timeout: 10,
            fetch: () => assert.fail('Cancelled preparation reached fetch'),
          }).callApi('sendDocument', { document: { source: path } })
      : () =>
          new Anygram({
            adapters: [
              createAdapter(
                'native',
                {
                  call: () => assert.fail('Cancelled preparation reached RPC'),
                },
                { kind: 'mtproto' }
              ),
            ],
          }).uploadFile(mode === 'account-input' ? new InputFile(path) : path, {
            timeout: 10,
          });
  const started = performance.now();
  await assert.rejects(upload(), /timed out/);
  const elapsed = performance.now() - started;
  const cancelledBeforeRelease = !releaseStarted;
  await released;
  for (let attempt = 0; attempt < 100; attempt++) {
    const entries = await readdir('/proc/self/fd');
    const links = await Promise.all(
      entries.map((entry) => readlink(`/proc/self/fd/${entry}`).catch(() => ''))
    );
    if (!links.includes(path)) {
      break;
    }
    assert(attempt < 99, 'A late-opened file handle was retained');
    await delay(1);
  }
  assert(
    cancelledBeforeRelease,
    `Upload cancellation waited ${elapsed.toFixed(1)}ms for filesystem open`
  );
  console.log(
    `${mode}: cancelled blocked filesystem open in ${elapsed.toFixed(1)}ms; no owned descriptor remains`
  );
} finally {
  try {
    await released;
  } finally {
    await rm(root, { recursive: true, force: true });
    globalThis.clearTimeout(watchdog);
  }
}
