import { it } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const suites = [
  ['test-terminal.js', /Test Results: 20 passed, 0 failed/],
  ['test-control-sequences.js', /Test Results: 7 passed, 0 failed/],
  ['test-subscription-system.js', /10 passed, 0 failed/],
  ['test-top-focused.js', /All tests PASSED!/],
  ['test-top-simulation.js', /Ready for integration with Telegram bot!/],
  ['test-bot-integration.js', /All bot integration tests passed!/],
  ['test-integration.js', /All integration tests completed successfully!/],
  ['test-verbose-mode.js', /VERBOSE MODE TEST COMPLETED/],
  ...[
    'debug-alt-screen-detailed.js',
    'debug-alt-screen.js',
    'debug-layout.js',
    'debug-line-clear.js',
    'debug-terminal.js',
  ].map((file) => [`debug/${file}`, /ANYGRAM_PINNED_TERMINAL_SCRIPT_COMPLETE/]),
];

function runSuite(path) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [
      '--max-old-space-size=64',
      '--stack-size=512',
      fileURLToPath(
        new globalThis.URL('upstream-suite-probe.mjs', import.meta.url)
      ),
      `src/tests/${path}`,
    ]);
    const chunks = [];
    let bytes = 0,
      failure;
    const watchdog = globalThis.setTimeout(() => {
      failure = new Error(
        `Pinned terminal script exceeded 20 seconds: ${path}`
      );
      child.kill('SIGKILL');
    }, 20000);
    const capture = (chunk) => {
      bytes += chunk.length;
      if (bytes > 128 * 1024) {
        failure = new Error(`Pinned terminal script exceeded 128 KiB: ${path}`);
        child.kill('SIGKILL');
      } else {
        chunks.push(chunk);
      }
    };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    child.on('error', (error) => {
      failure = error;
    });
    child.on('close', (code, signal) => {
      globalThis.clearTimeout(watchdog);
      const output = Buffer.concat(chunks).toString('utf8');
      const logDirectory = process.env.ANYGRAM_TERMINAL_LOG_DIR;
      try {
        if (logDirectory) {
          mkdirSync(logDirectory, { recursive: true });
          writeFileSync(
            join(
              logDirectory,
              path.replaceAll('/', '-').replace(/\.js$/, '.log')
            ),
            output
          );
        }
      } catch (error) {
        failure = error;
      }
      if (failure) {
        reject(failure);
      } else {
        resolve({ code, signal, output });
      }
    });
  });
}

for (const [path, marker] of suites) {
  it(
    `executes the complete pinned terminal script ${path}`,
    { timeout: 25000 },
    async () => {
      const result = await runSuite(path);
      assert.equal(result.code, 0, result.output);
      assert.equal(result.signal, null);
      assert.match(result.output, /ANYGRAM_PINNED_TERMINAL_SCRIPT_COMPLETE/);
      assert.match(result.output, marker);
    }
  );
}
