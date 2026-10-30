import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node-pty';
import { terminalHarness } from '../terminal-harness.mjs';
import { renderScenario } from './render-scenario.mjs';

it(
  'renders actual terminal canvas pixels and independently decodes all uploaded GIF frames',
  { timeout: 15000 },
  async () => {
    const before = await renderScenario({ migrated: false });
    assert.deepEqual(before.foreground, [0, 0, 0, 0]);
    const after = await renderScenario();
    assert.equal(after.decoder.width, 537);
    assert.equal(after.decoder.height, 614);
    assert.equal(after.decoder.numFrames(), 4);
    assert.equal(after.decoder.loopCount(), 0);
    assert(after.foreground.every((count) => count > 500));
    for (let index = 0; index < 4; index++) {
      assert.equal(after.decoder.frameInfo(index).delay, 100);
    }
    assert.equal(after.app.errors.length, 0);
    assert.deepEqual(after.app.exits, [0]);
    assert.equal(after.app.clock.pending, 0);
    assert.equal(after.app.userSessions.size, 0);
  }
);

for (const mode of ['text', 'visual']) {
  it(
    `executes pinned ${mode} handlers through a real, bounded PTY child`,
    { timeout: 10000 },
    async () => {
      let child,
        output = '',
        onExit;
      const exited = new Promise((resolve) => {
        onExit = resolve;
      });
      const app = terminalHarness(mode, {
        dependencies: {
          pty: {
            spawn(shell, args, options) {
              child = spawn(
                process.execPath,
                [
                  '--max-old-space-size=64',
                  '--eval',
                  [
                    "process.stdout.write('PTY ready\\n');",
                    "process.stdin.on('data', value => process.stdout.write('PTY received: ' + value));",
                    'setTimeout(() => process.exit(0), 3000);',
                  ].join(''),
                ],
                { ...options, env: { PATH: process.env.PATH, TERM: 'xterm' } }
              );
              child.onData((data) => {
                output += data;
                assert(output.length < 32768);
              });
              child.onExit(onExit);
              return child;
            },
          },
        },
      });
      try {
        await app.send('/start 1:1');
        await app.send('bounded fixture');
        await exited;
        await app.clock.advance(500);
        assert.match(output, /PTY ready/);
        assert.match(output, /PTY received: bounded fixture/);
        assert.equal(app.userSessions.size, 0);
        assert.equal(app.clock.pending, 0);
        assert.equal(app.errors.length, 0);
      } finally {
        if (child) {
          child.kill();
        }
        await exited;
        await app.signal('SIGTERM');
      }
    }
  );
}
