import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { terminalPrompt } from '../examples/follow-prompt.js';

function terminal() {
  const input = new PassThrough();
  input.isTTY = true;
  const chunks = [];
  const output = new Writable({
    write(chunk, _encoding, callback) {
      chunks.push(String(chunk));
      callback();
    },
  });
  output.isTTY = true;
  return { input, output, text: () => chunks.join('') };
}

it('suppresses password echo while returning the exact entered secret', async () => {
  const tty = terminal();
  try {
    const answer = terminalPrompt(tty.input, tty.output)('password', {
      secret: true,
    });
    tty.input.write('very-private-password\r');
    assert.equal(await answer, 'very-private-password');
    assert.match(tty.text(), /password:/);
    assert.equal(tty.text().includes('very-private-password'), false);
  } finally {
    tty.input.destroy();
    tty.output.end();
  }
});

it('echoes a nonsecret question and removes its interface after answering', async () => {
  const tty = terminal();
  const before = tty.input.listenerCount('data');
  try {
    const answer = terminalPrompt(tty.input, tty.output)('phoneNumber', {
      secret: false,
    });
    tty.input.write('+123456789\r');
    assert.equal(await answer, '+123456789');
    assert.match(tty.text(), /\+123456789/);
    // Node retains one reusable keypress decoder per input stream.
    assert(tty.input.listenerCount('data') <= before + 1);
    assert.equal(tty.input.listenerCount('keypress'), 0);
  } finally {
    tty.input.destroy();
    tty.output.end();
  }
});

it('closes an interrupted terminal question and rejects EOF instead of leaving a pending promise', async () => {
  for (const eof of [false, true]) {
    const tty = terminal();
    const controller = new globalThis.AbortController();
    try {
      const answer = terminalPrompt(tty.input, tty.output)('phoneCode', {
        secret: true,
        signal: controller.signal,
      });
      if (eof) {
        tty.input.end();
      } else {
        controller.abort(new Error('cancel question'));
      }
      await assert.rejects(answer, { name: 'AbortError' });
      assert.equal(tty.input.listenerCount('keypress'), 0);
    } finally {
      tty.input.destroy();
      tty.output.end();
    }
  }
});

it('rejects noninteractive secret input without opening an interface', async () => {
  const tty = terminal();
  tty.input.isTTY = false;
  try {
    await assert.rejects(
      terminalPrompt(tty.input, tty.output)('password', { secret: true }),
      /requires a terminal/
    );
    assert.equal(tty.input.listenerCount('data'), 0);
  } finally {
    tty.input.destroy();
    tty.output.end();
  }
});
