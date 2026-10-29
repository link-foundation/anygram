import { setImmediate as turn } from 'node:timers/promises';
import { createCanvas } from 'canvas';
import GIFEncoder from 'gifencoder';
import { GifReader } from 'omggif';
import { terminalHarness } from '../terminal-harness.mjs';

/** Actual pinned rendering code and real encoder, with finite application frames. */
export async function renderScenario({ migrated = true } = {}) {
  const canvases = [];
  const app = terminalHarness('visual', {
    migrated,
    dependencies: {
      GIFEncoder,
      createCanvas(width, height) {
        if (canvases.length >= 4 || width * height > 600000) {
          throw new RangeError('Terminal rendering exceeds fixture budget');
        }
        const canvas = createCanvas(width, height);
        canvases.push(canvas);
        return canvas;
      },
    },
  });
  try {
    await app.send('/start');
    app.terminals[0].data('anygram terminal\r\nreal canvas and GIF\r\n$ top');
    const command = app.send('top');
    await turn();
    await app.clock.advance(3500);
    await command;
    const upload = app.calls.find(({ method }) => method === 'sendAnimation');
    if (!upload) {
      throw new Error(
        `Animation was not submitted: ${JSON.stringify(app.errors)}`
      );
    }
    const part = upload.params.get('animation').slice('attach://'.length);
    const bytes = new Uint8Array(await upload.params.get(part).arrayBuffer());
    const decoder = new GifReader(bytes);
    const foreground = [];
    for (let index = 0; index < decoder.numFrames(); index++) {
      const pixels = new Uint8Array(decoder.width * decoder.height * 4);
      decoder.decodeAndBlitFrameRGBA(index, pixels);
      let count = 0;
      for (let pixel = 0; pixel < pixels.length; pixel += 4) {
        if (
          pixels[pixel] > 100 &&
          pixels[pixel + 1] > 100 &&
          pixels[pixel + 2] > 100
        ) {
          count++;
        }
      }
      foreground.push(count);
    }
    return {
      app,
      bytes,
      decoder,
      foreground,
      png: canvases[0].toBuffer('image/png'),
    };
  } finally {
    await app.signal('SIGTERM');
  }
}
