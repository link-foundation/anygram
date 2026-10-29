import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { Bot, webhookCallback } from '../src/index.js';

it('cancels an overflowing Fetch body without reading the rest or dispatching', async () => {
  let cancelled = 0;
  let handled = 0;
  const body = new globalThis.ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(65));
    },
    cancel() {
      cancelled++;
    },
  });
  const bot = new Bot('123:webhook', { botInfo: { id: 123 } });
  bot.use(() => handled++);
  await assert.rejects(
    webhookCallback(bot, 'bun', { maxBytes: 64 })(
      new globalThis.Request('http://localhost/webhook', {
        method: 'POST',
        body,
        duplex: 'half',
      })
    ),
    /exceeds byte limit/
  );
  assert.equal(cancelled, 1);
  assert.equal(body.locked, false);
  assert.equal(handled, 0);
});

it('rejects aborted Node bodies immediately and releases every owned listener', async () => {
  const request = Object.assign(new EventEmitter(), { headers: {} });
  const bot = new Bot('123:webhook', { botInfo: { id: 123 } });
  const callback = webhookCallback(bot, 'http', { timeoutMilliseconds: 200 });
  const task = callback(request, { end() {} });
  // Deliver only after the lazy body consumer owns its listeners.
  request.on('newListener', (event) => {
    if (event === 'error') {
      Promise.resolve().then(() => request.emit('aborted'));
    }
  });
  await assert.rejects(task, /Webhook request aborted/);
  for (const event of ['data', 'end', 'error', 'aborted']) {
    assert.equal(request.listenerCount(event), 0);
  }
});

for (const mode of [
  'reply',
  'empty',
  'unauthorized',
  'malformed',
  'overflow',
]) {
  it(`serves the http adapter ${mode} through real bounded Node sockets`, async () => {
    const bot = new Bot('123:webhook', {
      botInfo: { id: 123 },
      client: { canUseWebhookReply: () => true },
    });
    let handled = 0;
    bot.use(async (ctx) => {
      handled++;
      if (mode === 'reply') {
        await ctx.api.sendMessage(7, 'reply');
      }
    });
    const callback = webhookCallback(bot, 'http', {
      secretToken: 'secret',
      maxBytes: 64,
      timeoutMilliseconds: 1000,
    });
    const server = createServer((request, response) => {
      callback(request, response).catch((error) => {
        response.writeHead(error instanceof RangeError ? 413 : 400).end();
      });
    });
    server.requestTimeout = 3000;
    server.setTimeout(2000, (socket) => socket.destroy());
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const response = await globalThis.fetch(
        `http://127.0.0.1:${server.address().port}`,
        {
          method: 'POST',
          headers: {
            'x-telegram-bot-api-secret-token':
              mode === 'unauthorized' ? 'wrong' : 'secret',
          },
          body:
            mode === 'malformed'
              ? '{'
              : JSON.stringify({
                  update_id: 1,
                  ...(mode === 'overflow' && { text: 'x'.repeat(65) }),
                }),
          signal: globalThis.AbortSignal.timeout(2500),
        }
      );
      const status =
        { unauthorized: 401, malformed: 400, overflow: 413 }[mode] ?? 200;
      assert.equal(response.status, status);
      if (mode === 'reply') {
        assert.equal(response.headers.get('content-type'), 'application/json');
        assert.deepEqual(await response.json(), {
          chat_id: 7,
          text: 'reply',
          method: 'sendMessage',
        });
      } else {
        assert.equal(
          await response.text(),
          mode === 'unauthorized' ? 'secret token is wrong' : ''
        );
      }
      assert.equal(handled, ['reply', 'empty'].includes(mode) ? 1 : 0);
    } finally {
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    }
  });
}
