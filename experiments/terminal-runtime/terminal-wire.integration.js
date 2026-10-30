import { it } from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from 'canvas';
import { terminalHarness } from '../terminal-harness.mjs';
import {
  selectedBotClient,
  botRequestFields,
} from '../../tests/fixtures/bot-client.js';
import {
  uploadServer,
  multipartFields,
} from '../../tests/fixtures/bot-upload-server.js';

// Run on Node 20 with the original Telegraf multipart encoder, as in vendor-bot-wire.
for (const backend of [
  'native',
  'grammy',
  'telegraf',
  'node-telegram-bot-api',
]) {
  it(
    `executes terminal PNG and keyboard requests over actual selected ${backend} HTTP`,
    { timeout: 15000 },
    async () => {
      const server = await uploadServer({
        maxRequests: 16,
        result: () => ({ message_id: 1 }),
      });
      const api = await selectedBotClient(
        backend,
        server.root,
        'terminal:fixture'
      );
      let allocations = 0;
      const app = terminalHarness('visual', {
        botOptions: { api },
        dependencies: {
          createCanvas(width, height) {
            assert(++allocations <= 3 && width * height <= 600000);
            return createCanvas(width, height);
          },
        },
      });
      try {
        await app.send('/start');
        await app.send('pwd');
        app.terminals[0].data('selected backend PNG\r\n/tmp/terminal\r\n$ ');
        await app.clock.advance(150);
        await app.send('/controls');
        const menuRequest = server.requests.find(
          (request) =>
            !request.headers['content-type'].includes('multipart') &&
            botRequestFields(request).text === 'Terminal controls'
        );
        const buttons =
          botRequestFields(menuRequest).reply_markup.inline_keyboard.flat();
        await app.callback(
          buttons.find(({ text }) => text === 'Ctrl+C').callback_data
        );
        await app.callback(
          buttons.find(({ text }) => text === 'Screenshot').callback_data
        );
        await app.callback(
          buttons.find(({ text }) => text === 'Stop').callback_data
        );
        const photos = server.requests.filter(({ url }) =>
          url.endsWith('/sendPhoto')
        );
        assert.equal(photos.length, 2);
        for (const photo of photos) {
          const fields = multipartFields(photo);
          const value = fields.get('photo');
          const image =
            typeof value === 'string' ? fields.get(value.slice(9)) : value;
          assert.equal(image.name, 'terminal.png');
          const decoded = await loadImage(Buffer.from(image.bytes));
          assert.equal(decoded.width, 537);
          assert.equal(decoded.height, 614);
          assert.equal(fields.get('chat_id'), '7');
        }
        assert.equal(
          server.requests.filter(({ url }) =>
            url.endsWith('/answerCallbackQuery')
          ).length,
          3
        );
        assert.deepEqual(app.terminals[0].writes, ['pwd\r', '\x03']);
        assert.equal(app.terminals[0].killed, 1);
        assert.equal(app.userSessions.size, 0);
        assert.equal(app.errors.length, 0);
      } finally {
        await app.signal('SIGTERM');
        await server.close();
      }
    }
  );
}
