import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { TelegramBot } from '../src/index.js';
import { FileSessionStore } from '../src/storage.js';
import {
  communityFixture,
  communityStore,
} from './fixtures/community-harness.js';

const cli = () => import('../examples/community-posts-cli.mjs');
const token = '12345:abcdefghijklmnopqrstuvwxyz_123456';

function harness({ updates = [], blocked = false } = {}) {
  const events = [],
    output = [],
    calls = [];
  let bot;
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  return {
    events,
    output,
    calls,
    ready,
    bot: () => bot,
    io: {
      store: communityStore(),
      write: (value) => output.push(value),
      writeError: (value) => output.push(value),
      readToken: async () => token,
      createAccount: async (options) => {
        events.push(['account', options]);
        return {
          async run(task) {
            events.push('connect');
            try {
              return await task({ searchMessages: async () => [] });
            } finally {
              events.push('disconnect');
            }
          },
        };
      },
      createBot: async (options) => {
        events.push(['bot', options]);
        bot = new TelegramBot(token, {
          api: {
            async callApi(method, params, request) {
              calls.push({ method, params });
              if (method === 'getMe') {
                return { id: 99, is_bot: true, username: 'fixture_bot' };
              }
              if (method === 'getUpdates') {
                entered();
                if (blocked) {
                  return new Promise((resolve, reject) => {
                    request.signal.addEventListener(
                      'abort',
                      () => reject(request.signal.reason),
                      { once: true }
                    );
                  });
                }
                return updates;
              }
              return method === 'sendMessage' ? { message_id: 100 } : true;
            },
          },
        });
        return bot;
      },
      polling: { maxPolls: 1, timeout: 0 },
    },
  };
}

it('validates community CLI arguments and help before reading tokens or accounts', async () => {
  const { runCommunityCli } = await cli();
  const state = harness();
  assert.equal((await runCommunityCli(['--help'], state.io)).exitCode, 0);
  assert.match(state.output.join(''), /bot-backend|account-backend/);
  for (const args of [
    ['--unknown'],
    ['--bot-backend', 'gramjs'],
    ['--account-backend', 'telegraf'],
    ['--channel', '../bad'],
  ]) {
    await assert.rejects(runCommunityCli(args, state.io));
  }
  assert.equal(state.events.length, 0);
});

it('connects the selected community account before polling and drains before disconnect', async () => {
  const { runCommunityCli } = await cli();
  const state = harness();
  const result = await runCommunityCli(
    ['--bot-backend', 'grammy', '--account-backend', 'teleproto'],
    state.io
  );
  assert.equal(result.exitCode, 0);
  assert.equal(
    state.events.find((e) => Array.isArray(e) && e[0] === 'bot')[1].backend,
    'grammy'
  );
  assert.equal(
    state.events.find((e) => Array.isArray(e) && e[0] === 'account')[1].backend,
    'teleproto'
  );
  assert.equal(state.events.at(-1), 'disconnect');
  assert.equal(state.bot().isRunning(), false);
  assert.equal(state.bot().listeners.length, 0);
  assert.deepEqual(
    state.calls.map((c) => c.method),
    ['getMe', 'getUpdates']
  );
});

it('cancels blocked community polling and removes only its owned lifecycle handlers', async () => {
  const { runCommunityCli } = await cli();
  const controller = new globalThis.AbortController();
  const state = harness({ blocked: true });
  const running = runCommunityCli([], {
    ...state.io,
    signal: controller.signal,
  });
  running.catch(() => {});
  await state.ready;
  controller.abort(new Error('Interrupted'));
  await running;
  assert.equal(state.bot().isRunning(), false);
  assert.equal(state.bot().listeners.length, 0);
  assert.equal(state.events.at(-1), 'disconnect');
});

it('continues community polling after a handled update error without leaking message contents', async () => {
  const { runCommunityCli } = await cli();
  const query = (id, username) => ({
    update_id: id,
    callback_query: {
      id: `q${id}`,
      from: { id, username },
      message: { chat: { id: id + 1000 } },
      data: 'post_message',
    },
  });
  const state = harness({ updates: [query(1, 'user_1'), query(2, 'user_2')] });
  state.io.store.save = async () => {
    throw new Error(`secret ${token}`);
  };
  await runCommunityCli([], state.io);
  assert.equal(
    state.calls.filter((c) => c.method === 'answerCallbackQuery').length,
    2
  );
  assert.equal(state.output.length, 2);
  assert(!state.output.join('').includes(token));
  assert.equal(state.bot().offset, 3);
});

it('reads the original community token file with a finite bound before startup', async () => {
  const { runCommunityCli } = await cli();
  const directory = await mkdtemp(join(tmpdir(), 'anygram-community-token-'));
  const path = join(directory, 'token');
  const state = harness();
  delete state.io.readToken;
  try {
    await writeFile(path, `${token}\n`);
    await runCommunityCli(['--token-file', path], state.io);
    state.events.length = 0;
    await writeFile(path, 'x'.repeat(1025));
    await assert.rejects(
      runCommunityCli(['--token-file', path], state.io),
      /1024|1 KiB/
    );
    assert.equal(state.events.length, 0);
    await writeFile(path, 'invalid');
    await assert.rejects(
      runCommunityCli(['--token-file', path], state.io),
      /token/i
    );
    assert.equal(state.events.length, 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

it('restores a community prompt and daily limit from the actual atomic file store', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'anygram-community-state-'));
  const path = join(directory, 'state.json');
  let fixture;
  try {
    fixture = await communityFixture({ store: new FileSessionStore(path) });
    await fixture.callback(1);
    await fixture.app.close();
    fixture = await communityFixture({ store: new FileSessionStore(path) });
    await fixture.text(1, 'durable');
    assert.equal(fixture.posts().length, 1);
    await fixture.app.close();
    fixture = await communityFixture({ store: new FileSessionStore(path) });
    await fixture.callback(1);
    await fixture.text(1, 'limited');
    assert.equal(fixture.posts().length, 0);
    if (process.platform !== 'win32') {
      assert.equal((await stat(path)).mode & 0o777, 0o600);
    }
  } finally {
    await fixture?.app.close();
    await rm(directory, { recursive: true, force: true });
  }
});
