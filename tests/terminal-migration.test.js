import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { execFileSync } from 'node:child_process';
import { Bot as GrammyBot } from 'grammy';
import { terminalHarness } from '../experiments/terminal-harness.mjs';

async function settles(task) {
  let timer;
  try {
    return await Promise.race([
      task,
      new Promise((_, reject) => {
        timer = globalThis.setTimeout(
          () => reject(new Error('Terminal scenario did not settle')),
          1000
        );
      }),
    ]);
  } finally {
    globalThis.clearTimeout(timer);
  }
}

for (const mode of ['text', 'visual']) {
  it(`executes pinned ${mode} authorization, aspect ratios, input and control sequences`, async () => {
    const app = terminalHarness(mode);
    await app.send('/start', { id: 99 });
    assert.equal(app.terminals.length, 0);
    assert.match(app.calls.at(-1).params.text, /not authorized/);
    await app.send('/start invalid');
    assert.equal(app.terminals.length, 0);
    await app.send('/start 1:1');
    assert.equal(app.terminals.length, 1);
    assert.equal(app.terminals[0].options.cols, 44);
    assert.equal(app.terminals[0].options.rows, 44);
    for (const command of [
      'pwd',
      '`ls`',
      '```echo ok```',
      '^C',
      'ctrl+d',
      'CTRL+Z',
    ]) {
      await app.send(command);
    }
    assert.deepEqual(app.terminals[0].writes, [
      'pwd\r',
      'ls\r',
      'echo ok\r',
      '\x03',
      '\x04',
      '\x1a',
    ]);
    await app.clock.advance(500);
    assert.equal(app.errors.length, 0);
    assert.deepEqual(app.exits, []);
    const username = terminalHarness(mode, {
      env: {
        AUTHORIZED_USER_ID: '',
        AUTHORIZED_USERNAME: '@owner',
      },
    });
    await username.send('/start', { id: 42, username: 'owner' });
    assert.equal(username.terminals.length, 1);
    await username.send('/start', { id: 43, username: 'stranger' });
    assert.equal(username.terminals.length, 1);
    assert.match(username.calls.at(-1).params.text, /not authorized/);
  });

  it(`migrates pinned ${mode} help and stop before terminal text dispatch`, async () => {
    const app = terminalHarness(mode);
    await app.send('/help');
    assert.match(app.calls.at(-1).params.text, /Terminal Bot Help/);
    await app.send('/start');
    await app.send('/stop');
    assert.equal(app.userSessions.size, 0);
    assert.equal(app.terminals[0].killed, 1);
    assert.deepEqual(app.terminals[0].writes, []);
    await app.send('/stop');
    assert.match(app.calls.at(-1).params.text, /No active terminal/);
  });

  it(`migrates pinned ${mode} restart into an awaited command update`, async () => {
    const app = terminalHarness(mode);
    await app.send('/start 9:16');
    await settles(app.send('/restart'));
    assert.equal(app.terminals.length, 2);
    assert.equal(app.terminals[0].killed, 1);
    assert.equal(app.terminals[1].options.cols, 56);
    assert.equal(app.userSessions.get(8).terminal, app.terminals[1]);
    assert.deepEqual(app.exits, []);
  });

  it(`executes pinned ${mode} edits and structured 400-error recovery`, async () => {
    const app = terminalHarness(mode);
    await app.send('/start');
    app.terminals[0].data('first output');
    await app.clock.advance(150);
    const edit = app.calls.find((call) => call.method === 'editMessageText');
    assert.equal(edit.params.chat_id, 7);
    assert.equal(edit.params.message_id, 1);
    assert.equal(edit.params.parse_mode, 'Markdown');
    assert.match(edit.params.text, /first output/);
    const sends = () =>
      app.calls.filter((call) => call.method === 'sendMessage').length;
    app.fail((method) =>
      method === 'editMessageText'
        ? {
            ok: false,
            error_code: 400,
            description: 'Bad Request: message is not modified',
          }
        : undefined
    );
    const before = sends();
    app.terminals[0].data('next');
    await app.clock.advance(150);
    assert.equal(sends(), before);
    app.fail((method) =>
      method === 'editMessageText'
        ? {
            ok: false,
            error_code: 400,
            description: 'Bad Request: message to edit not found',
          }
        : undefined
    );
    app.terminals[0].data('replacement');
    await app.clock.advance(150);
    assert.equal(sends(), before + 1);
    assert.equal(app.userSessions.get(8).messageId, app.calls.length);
    assert.deepEqual(app.exits, []);
  });

  it(`keeps retired ${mode} PTY callbacks from deleting or editing a replacement session`, async () => {
    const app = terminalHarness(mode);
    await app.send('/start');
    const retired = app.terminals[0];
    const oldSession = app.userSessions.get(8);
    await app.send('/start 1:1');
    retired.data('stale output');
    retired.exit();
    await app.clock.advance(500);
    assert.equal(app.userSessions.get(8)?.terminal, app.terminals[1]);
    assert(
      !app.calls.some((call) => call.params.text?.includes('stale output'))
    );
    assert.equal(oldSession.virtualTerminal?.changeListeners.size ?? 0, 0);
    app.terminals[1].exit();
    await turn();
    assert.equal(app.userSessions.size, 0);
    assert.equal(app.clock.pending, 0);
  });

  it(`cleans pinned ${mode} PTYs, timers and subscriptions on stop and signals`, async () => {
    const app = terminalHarness(mode);
    await app.send('/start');
    app.terminals[0].data('pending output');
    await app.send('/stop');
    assert.equal(app.clock.pending, 0);
    assert.equal(app.userSessions.size, 0);
    await app.send('/start');
    await app.signal('SIGTERM');
    assert.equal(app.terminals[1].killed, 1);
    assert.equal(app.clock.pending, 0);
    assert.deepEqual(app.exits, [0]);
    const interrupted = terminalHarness(mode);
    await interrupted.send('/start');
    await interrupted.signal('SIGINT');
    assert.equal(interrupted.terminals[0].killed, 1);
    assert.equal(interrupted.clock.pending, 0);
    assert.equal(interrupted.userSessions.size, 0);
    assert.deepEqual(interrupted.exits, [0]);
  });

  it(`compares migrated ${mode} command effects with actual grammY`, async () => {
    const reference = terminalHarness(mode, { Constructor: GrammyBot });
    const native = terminalHarness(mode);
    for (const app of [reference, native]) {
      await app.send('/start');
      await app.send('`pwd`');
      await app.send('/help');
      await app.send('/stop');
    }
    const effects = (app) => ({
      replies: app.calls
        .filter((call) => call.method === 'sendMessage')
        .map(({ params }) => ({
          chat_id: params.chat_id,
          text: params.text,
          parse_mode: params.parse_mode,
        })),
      writes: app.terminals.map((terminal) => terminal.writes),
      kills: app.terminals.map((terminal) => terminal.killed),
    });
    assert.deepEqual(effects(native), effects(reference));
  });
}

it('uploads the pinned visual animation with current captured terminal output', async () => {
  const app = terminalHarness('visual');
  await app.send('/start');
  app.terminals[0].data('visible frame');
  const command = app.send('top');
  await turn();
  await app.clock.advance(3500);
  await settles(command);
  assert.equal(app.frames.length, 4);
  assert(
    app.frames.every((frame) =>
      frame.some((line) => line.includes('visible frame'))
    )
  );
  const animation = app.calls.find((call) => call.method === 'sendAnimation');
  assert(animation.params instanceof FormData);
  const attachment = animation.params.get('animation');
  const bytes = await animation.params.get(attachment.slice(9)).arrayBuffer();
  assert.equal(Buffer.from(bytes).toString(), 'GIF89a');
  assert.equal(app.errors.length, 0);
  assert.deepEqual(app.exits, []);
});

it('applies the complete terminal migration patch to both immutable sources', () => {
  execFileSync(
    'git',
    [
      'apply',
      '--check',
      '--directory=docs/case-studies/issue-1/data/terminal-source',
      'docs/case-studies/issue-1/terminal-migration.patch',
    ],
    { maxBuffer: 1024 * 1024 }
  );
});
