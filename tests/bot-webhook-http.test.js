import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { Telegraf } from '../src/index.js';

/** Finite incoming Telegram-like HTTP requests with an actual Node response. */
async function incomingWebhook(run) {
  const bot = new Telegraf('123:webhook', {
    api: { callApi: async () => true },
  });
  const server = createServer((request, response) => {
    bot
      .handleUpdate(
        { update_id: 1, message: { message_id: 9, chat: { id: 7 } } },
        response
      )
      .catch((error) => response.destroy(error));
  });
  server.requestTimeout = 5000;
  server.setTimeout(3000, (socket) => socket.destroy());
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    await run(bot, () =>
      globalThis.fetch(`http://127.0.0.1:${server.address().port}`, {
        method: 'POST',
        signal: globalThis.AbortSignal.timeout(3000),
      })
    );
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}

it('sends one Telegraf Bot API operation through a real Node HTTP response', async () => {
  await incomingWebhook(async (bot, request) => {
    bot.use((ctx) => ctx.deleteMessage());
    const response = await request();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'application/json');
    assert.deepEqual(await response.json(), {
      method: 'deleteMessage',
      chat_id: 7,
      message_id: 9,
    });
  });
});

it('ends an unused Telegraf response after ordinary API dispatch', async () => {
  await incomingWebhook(async (bot, request) => {
    bot.use((ctx) => ctx.reply('HTTP'));
    const response = await request();
    assert.equal(await response.text(), '');
    assert.equal(response.status, 200);
  });
});

it('ends a duplicate update response instead of leaving a Node socket pending', async () => {
  await incomingWebhook(async (bot, request) => {
    let handled = 0;
    bot.use(() => {
      handled++;
    });
    assert.equal(await (await request()).text(), '');
    assert.equal(await (await request()).text(), '');
    assert.equal(handled, 1);
  });
});
