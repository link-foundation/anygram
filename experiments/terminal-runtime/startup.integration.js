import { it } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { once } from 'node:events';
import { Writable } from 'node:stream';
import { config } from 'dotenv';
import { terminalHarness } from '../terminal-harness.mjs';
import { terminalLogger } from './log-destination.mjs';

function startupFixture(contents) {
  const root = mkdtempSync(join(tmpdir(), 'anygram-terminal-startup-'));
  const env = {},
    streams = [];
  const path = join(root, '.env');
  writeFileSync(path, contents);
  let written = 0;
  const stdout = new Writable({
    write(bytes, encoding, done) {
      written += bytes.length;
      done(
        written > 65536
          ? new RangeError('Startup log fixture exceeded 64 KiB')
          : undefined
      );
    },
  });
  return {
    root,
    env,
    streams,
    processExtras: { env, stdout },
    dependencies: {
      pino: terminalLogger(root, (stream) => streams.push(stream)),
      config: () => config({ path, processEnv: env }),
      mkdirSync: (directory, options) =>
        mkdirSync(join(root, directory), options),
    },
    async close() {
      for (const stream of streams) {
        if (!stream.destroyed) {
          const closed = once(stream, 'close');
          stream.end();
          await closed;
        }
      }
      stdout.end();
      rmSync(root, { recursive: true, force: true });
    },
  };
}

for (const mode of ['text', 'visual']) {
  it(
    `executes complete pinned ${mode} startup with actual dotenv, pino and flushed file logs`,
    { timeout: 5000 },
    async () => {
      const fixture = startupFixture(
        'BOT_TOKEN=startup:fixture\nAUTHORIZED_USER_ID=8\n'
      );
      let enterPoll;
      const entered = new Promise((resolve) => {
        enterPoll = resolve;
      });
      let app;
      try {
        app = terminalHarness(mode, {
          ...fixture,
          startup: true,
          initialization: true,
          botOptions: { botInfo: undefined },
          fetch: async (method, params, options) => {
            if (method === 'getUpdates') {
              enterPoll();
              await new Promise((resolve) =>
                options.signal.addEventListener('abort', resolve, {
                  once: true,
                })
              );
              throw new Error('controlled polling stop');
            }
            return new Response(
              JSON.stringify({
                ok: true,
                result:
                  method === 'getMe'
                    ? { id: 1, is_bot: true, username: 'terminalbot' }
                    : { message_id: 2 },
              })
            );
          },
        });
        await entered;
        assert.equal(app.bot.botInfo.username, 'terminalbot');
        await app.send('/help');
        const closed = once(app.logStream, 'close');
        await app.signal('SIGTERM');
        await closed;
        assert.deepEqual(app.exits, [0]);
        assert.equal(app.logStream.destroyed, true);
        assert.equal(app.bot.isRunning(), false);
        const records = readFileSync(join(fixture.root, 'logs/bot.log'), 'utf8')
          .trim()
          .split('\n')
          .map((line) => JSON.parse(line));
        assert(
          records.some(
            (record) => record.msg === 'Starting Telegram Terminal Bot...'
          )
        );
        assert(
          records.some(
            (record) => record.msg === 'Bot is now listening for messages'
          )
        );
        assert.equal(
          records.at(-1).msg,
          'All terminal sessions and polling closed'
        );
        assert(records.every((record) => typeof record.time === 'string'));
        assert.equal(
          app.calls.filter(({ method }) => method === 'getMe').length,
          1
        );
        assert.equal(
          app.calls.filter(({ method }) => method === 'getUpdates').length,
          1
        );
      } finally {
        if (app?.bot.isRunning()) {
          await app.signal('SIGINT');
        }
        await fixture.close();
      }
    }
  );

  for (const [label, contents, reason] of [
    [
      'token',
      'AUTHORIZED_USER_ID=8\n',
      'BOT_TOKEN environment variable is required',
    ],
    [
      'authorization',
      'BOT_TOKEN=startup:fixture\n',
      'Either AUTHORIZED_USER_ID or AUTHORIZED_USERNAME must be set',
    ],
  ]) {
    it(
      `rejects missing ${label} before pinned ${mode} bot construction and persists the fatal log`,
      { timeout: 5000 },
      async () => {
        const fixture = startupFixture(contents);
        try {
          assert.throws(
            () =>
              terminalHarness(mode, {
                ...fixture,
                startup: true,
                initialization: true,
                dependencies: {
                  ...fixture.dependencies,
                  Bot: class {
                    constructor() {
                      assert.fail('Invalid startup constructed a bot');
                    }
                  },
                },
              }),
            /requested failure exit 1/
          );
          const stream = fixture.streams[0];
          const closed = once(stream, 'close');
          stream.end();
          await closed;
          const records = readFileSync(
            join(fixture.root, 'logs/bot.log'),
            'utf8'
          )
            .trim()
            .split('\n')
            .map((line) => JSON.parse(line));
          assert.equal(records.at(-1).msg, reason);
          assert.equal(records.at(-1).level, 'fatal');
        } finally {
          await fixture.close();
        }
      }
    );
  }
}
