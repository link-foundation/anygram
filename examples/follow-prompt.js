import { createInterface } from 'node:readline/promises';
import { Writable } from 'node:stream';

/** Keep login prompts off JSON stdout and suppress terminal echo for secrets. */
export function terminalPrompt(input, output) {
  return async (name, { secret, signal }) => {
    if (!input.isTTY || !output.isTTY) {
      throw new Error(
        'Interactive login requires a terminal; configure credentials and a saved session'
      );
    }
    signal?.throwIfAborted();
    let muted = false;
    const display = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          output.write(chunk, encoding);
        }
        callback();
      },
    });
    const controller = new globalThis.AbortController();
    const combined = signal
      ? globalThis.AbortSignal.any([signal, controller.signal])
      : controller.signal;
    const readline = createInterface({
      input,
      output: display,
      terminal: true,
    });
    readline.once('close', () =>
      controller.abort(new Error('Login input closed'))
    );
    try {
      output.write(`${name}: `);
      muted = secret;
      return await readline.question('', { signal: combined });
    } finally {
      muted = false;
      readline.close();
      display.end();
      output.write('\n');
    }
  };
}
