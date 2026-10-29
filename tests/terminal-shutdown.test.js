import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { terminalHarness } from '../experiments/terminal-harness.mjs';

function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

for (const mode of ['text', 'visual']) {
  it(`awaits the pinned ${mode} polling request before exiting on both signals`, async () => {
    const entered = deferred(),
      cancelled = deferred(),
      drain = deferred();
    const app = terminalHarness(mode, {
      startup: true,
      fetch: async (method, params, options) => {
        assert.equal(method, 'getUpdates');
        entered.resolve();
        await new Promise((resolve) => {
          options.signal.addEventListener('abort', resolve, { once: true });
        });
        cancelled.resolve();
        await drain.promise;
        throw new Error('controlled poll cancellation');
      },
    });
    try {
      await entered.promise;
      const first = app.signal('SIGTERM');
      const second = app.signal('SIGINT');
      await cancelled.promise;
      await turn();
      assert.deepEqual(
        app.exits,
        [],
        'process must stay alive until polling drains'
      );
      drain.resolve();
      await Promise.all([first, second]);
      await app.polling;
      assert.deepEqual(
        app.exits,
        [0],
        'simultaneous signals share one shutdown'
      );
      assert.equal(app.bot.isRunning(), false);
      assert.equal(app.errors.length, 0);
    } finally {
      drain.resolve();
      app.bot.stop();
      await app.polling;
    }
  });
}

it('cancels an active visual animation before signal shutdown drains accepted handlers', async () => {
  const app = terminalHarness('visual');
  await app.send('/start');
  app.terminals[0].data('animation in progress');
  const command = app.send('top');
  await turn();
  await app.clock.advance(1000);
  const shutdown = app.signal('SIGTERM');
  try {
    await turn();
    assert.equal(
      app.clock.pending,
      0,
      'all frame and wait timers must be cleared'
    );
    await command;
    await shutdown;
    assert(!app.calls.some(({ method }) => method === 'sendAnimation'));
    assert.equal(app.userSessions.size, 0);
    assert.deepEqual(app.exits, [0]);
  } finally {
    await app.clock.advance(5000);
    await command;
    await shutdown;
  }
});

it('awaits the terminal log destination before reporting a successful exit', async () => {
  const flushing = deferred(),
    release = deferred();
  const app = terminalHarness('text', {
    dependencies: {
      logStream: {
        once(event, callback) {
          if (event === 'finish') {
            this.finish = callback;
          }
        },
        end() {
          flushing.resolve();
          release.promise.then(this.finish);
        },
      },
    },
  });
  const shutdown = app.signal('SIGINT');
  try {
    await turn();
    assert.deepEqual(
      app.exits,
      [],
      'buffered log writes must finish before process.exit'
    );
    release.resolve();
    await flushing.promise;
    await shutdown;
    assert.deepEqual(app.exits, [0]);
  } finally {
    release.resolve();
    await shutdown;
  }
});
