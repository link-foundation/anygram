import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { setImmediate as turn } from 'node:timers/promises';
import { Bot as GrammyBot, InputFile } from 'grammy';
import { terminalHarness } from '../experiments/terminal-harness.mjs';

async function controls(app) {
  await app.send('/controls');
  const menu = app.calls.at(-1).params.reply_markup;
  assert(menu?.inline_keyboard, 'Terminal controls must expose a keyboard');
  return menu.inline_keyboard.flat();
}

for (const mode of ['text', 'visual']) {
  it(`retains evidence that pinned original ${mode} source lacks keyboard controls`, async () => {
    const app = terminalHarness(mode, { migrated: false });
    try {
      await app.send('/start');
      await app.send('/controls');
      assert(
        !app.calls.some(({ params }) => params.reply_markup?.inline_keyboard)
      );
      assert.deepEqual(app.terminals[0].writes, ['/controls\r']);
      await app.callback('terminal:1:interrupt');
      assert(!app.calls.some(({ method }) => method === 'answerCallbackQuery'));
    } finally {
      await app.signal('SIGTERM');
    }
  });

  it(`executes ${mode} terminal keyboard control bytes and retires stopped menus`, async () => {
    const app = terminalHarness(mode);
    try {
      await app.send('/start');
      const buttons = await controls(app);
      for (const label of ['Ctrl+C', 'Ctrl+D', 'Ctrl+Z']) {
        await app.callback(
          buttons.find(({ text }) => text === label).callback_data
        );
        assert.equal(app.calls.at(-1).method, 'answerCallbackQuery');
      }
      assert.deepEqual(app.terminals[0].writes, ['\x03', '\x04', '\x1a']);
      const stop = buttons.find(({ text }) => text === 'Stop').callback_data;
      await app.callback(stop);
      assert.equal(app.terminals[0].killed, 1);
      assert.equal(app.userSessions.size, 0);
      assert.equal(app.clock.pending, 0);
      assert.equal(app.calls.at(-1).method, 'editMessageReplyMarkup');
      await app.callback(stop);
      assert.equal(app.calls.at(-1).params.show_alert, true);
      assert.equal(app.terminals[0].killed, 1);
      assert.equal(app.errors.length, 0);
    } finally {
      await app.signal('SIGTERM');
    }
  });

  it(`rejects foreign, forged and stale ${mode} terminal keyboard actions`, async () => {
    const app = terminalHarness(mode);
    try {
      await app.send('/controls');
      assert.match(app.calls.at(-1).params.text, /No active terminal/);
      await app.send('/start');
      const buttons = await controls(app);
      const stop = buttons.find(({ text }) => text === 'Stop').callback_data;
      for (const options of [{ from: { id: 99 } }, { chatId: 99 }]) {
        await app.callback(stop, options);
        assert.equal(app.calls.at(-1).method, 'answerCallbackQuery');
        assert.equal(app.calls.at(-1).params.show_alert, true);
        assert.equal(app.terminals[0].killed, 0);
      }
      await app.callback(stop.replace(/stop$/, 'forged'));
      assert.equal(app.calls.at(-1).params.show_alert, true);
      await app.send('/start');
      await app.callback(stop);
      assert.equal(app.calls.at(-1).params.show_alert, true);
      assert.equal(app.terminals[1].killed, 0);
      assert.deepEqual(app.terminals[1].writes, []);
    } finally {
      await app.signal('SIGTERM');
    }
  });

  it(`compares ${mode} terminal keyboard effects with actual grammY`, async () => {
    const apps = [
      terminalHarness(mode),
      terminalHarness(mode, {
        Constructor: GrammyBot,
        dependencies: { InputFile },
      }),
    ];
    try {
      for (const app of apps) {
        await app.send('/start');
        const buttons = await controls(app);
        await app.callback(buttons[0].callback_data);
        await app.callback(
          buttons.find(({ text }) => text === 'Stop').callback_data
        );
      }
      const effects = (app) => ({
        calls: app.calls
          .filter(({ method }) => method !== 'getMe')
          .map(({ method, params }) => ({
            method,
            params: JSON.parse(JSON.stringify(params)),
          })),
        writes: app.terminals[0].writes,
        kills: app.terminals[0].killed,
      });
      assert.deepEqual(effects(apps[0]), effects(apps[1]));
    } finally {
      for (const app of apps) {
        await app.signal('SIGTERM');
      }
    }
  });
}

it('captures regular visual command output as PNG and permits an explicit screenshot', async () => {
  const app = terminalHarness('visual');
  try {
    await app.send('/start');
    await app.send('pwd');
    app.terminals[0].data('/tmp/terminal\r\n$ ');
    await app.clock.advance(150);
    const photo = app.calls.find(({ method }) => method === 'sendPhoto');
    assert(
      photo?.params instanceof FormData,
      'Regular command must upload a photo'
    );
    const part = photo.params.get('photo').slice(9);
    assert.equal(photo.params.get(part).name, 'terminal.png');
    assert.equal(
      Buffer.from(await photo.params.get(part).arrayBuffer()).toString(),
      'PNG fixture'
    );
    const buttons = await controls(app);
    await app.callback(
      buttons.find(({ text }) => text === 'Screenshot').callback_data
    );
    assert.equal(
      app.calls.filter(({ method }) => method === 'sendPhoto').length,
      2
    );
    assert.equal(app.errors.length, 0);
  } finally {
    await app.signal('SIGTERM');
  }
});

for (const failure of ['upload', 'canvas', 'dimensions']) {
  it(`keeps a visual terminal usable after ${failure} screenshot failure without replay`, async () => {
    let allocations = 0;
    const app = terminalHarness('visual', {
      dependencies:
        failure === 'canvas'
          ? {
              createCanvas() {
                allocations++;
                throw new Error('controlled canvas failure');
              },
            }
          : {},
    });
    try {
      await app.send('/start');
      if (failure === 'upload') {
        app.fail((method) =>
          method === 'sendPhoto'
            ? {
                ok: false,
                error_code: 500,
                description: 'controlled photo failure',
              }
            : undefined
        );
      } else if (failure === 'dimensions') {
        app.userSessions.get(8).cols = 81;
      }
      await app.send('pwd');
      app.terminals[0].data('output');
      await app.clock.advance(500);
      assert.equal(
        app.calls.filter(({ method }) => method === 'sendPhoto').length,
        failure === 'upload' ? 1 : 0
      );
      assert(
        app.calls.some(({ params }) =>
          params.text?.includes('Failed to capture terminal screenshot')
        )
      );
      assert.equal(allocations, failure === 'canvas' ? 1 : 0);
      assert.deepEqual(app.exits, []);
      assert.equal(app.terminals[0].killed, 0);
      assert.equal(app.userSessions.get(8).screenshotTask, undefined);
      await app.send('^C');
      assert.equal(app.terminals[0].writes.at(-1), '\x03');
    } finally {
      await app.signal('SIGTERM');
    }
  });
}

for (const action of ['SIGINT', 'SIGTERM', '/stop']) {
  it(`cancels and drains an in-flight static PNG on ${action}`, async () => {
    let entered,
      cancelled = 0;
    const started = new Promise((resolve) => {
      entered = resolve;
    });
    const app = terminalHarness('visual', {
      fetch(method, params, options) {
        if (method === 'sendPhoto') {
          entered();
          return new Promise((resolve, reject) => {
            options.signal.addEventListener(
              'abort',
              () => {
                cancelled++;
                reject(options.signal.reason);
              },
              { once: true }
            );
          });
        }
        return Promise.resolve(
          new Response(JSON.stringify({ ok: true, result: { message_id: 1 } }))
        );
      },
    });
    let timer, capture, coalesced;
    try {
      await app.send('/start');
      await app.send('pwd');
      app.terminals[0].data('output');
      capture = app.clock.advance(150);
      await Promise.race([
        started,
        new Promise((_, reject) => {
          timer = globalThis.setTimeout(
            () => reject(new Error('PNG upload did not start')),
            2000
          );
        }),
      ]);
      if (action === 'SIGTERM') {
        const buttons = await controls(app);
        coalesced = app.callback(
          buttons.find(({ text }) => text === 'Screenshot').callback_data
        );
        await turn();
        assert.equal(
          app.calls.filter(({ method }) => method === 'sendPhoto').length,
          1
        );
      }
      if (action === '/stop') {
        await app.send(action);
      } else {
        await Promise.all([
          app.signal(action),
          app.signal(action === 'SIGINT' ? 'SIGTERM' : 'SIGINT'),
        ]);
      }
      await Promise.all([capture, coalesced]);
      await turn();
      assert.equal(cancelled, 1);
      assert.equal(app.userSessions.size, 0);
      assert.equal(app.clock.pending, 0);
      assert.equal(
        app.calls.filter(({ method }) => method === 'sendPhoto').length,
        1
      );
      assert.equal(
        app.calls.filter(({ params }) =>
          params.text?.includes('Failed to capture')
        ).length,
        0
      );
      assert.deepEqual(app.exits, action === '/stop' ? [] : [0]);
    } finally {
      globalThis.clearTimeout(timer);
      await app.signal('SIGTERM');
      await Promise.all([capture, coalesced]);
    }
  });
}
