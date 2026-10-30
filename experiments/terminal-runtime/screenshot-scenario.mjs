import { createCanvas, loadImage } from 'canvas';
import { terminalHarness } from '../terminal-harness.mjs';

/** Execute the complete visual handler and decode its actual uploaded PNG. */
export async function screenshotScenario({ migrated = true } = {}) {
  let allocations = 0;
  const app = terminalHarness('visual', {
    migrated,
    dependencies: {
      createCanvas(width, height) {
        if (++allocations > 3 || width * height > 600000) {
          throw new RangeError(
            'Screenshot fixture exceeded its finite canvas budget'
          );
        }
        return createCanvas(width, height);
      },
    },
  });
  try {
    await app.send('/start');
    await app.send('pwd');
    app.terminals[0].data(
      'anygram terminal\r\nstatic PNG screenshot\r\n/tmp/terminal\r\n$ '
    );
    await app.clock.advance(150);
    const upload = app.calls.find(({ method }) => method === 'sendPhoto');
    if (!upload) {
      return { app, bytes: null, foreground: 0 };
    }
    const attachment = upload.params.get('photo').slice(9);
    const bytes = Buffer.from(
      await upload.params.get(attachment).arrayBuffer()
    );
    const image = await loadImage(bytes);
    const canvas = createCanvas(image.width, image.height);
    const context = canvas.getContext('2d');
    context.drawImage(image, 0, 0);
    const { data } = context.getImageData(0, 0, image.width, image.height);
    let foreground = 0;
    for (let pixel = 0; pixel < data.length; pixel += 4) {
      if (data[pixel] > 100 && data[pixel + 1] > 100 && data[pixel + 2] > 100) {
        foreground++;
      }
    }
    return { app, bytes, width: image.width, height: image.height, foreground };
  } finally {
    await app.signal('SIGTERM');
  }
}
