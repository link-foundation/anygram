import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot as ActualBot, webhookCallback as actualCallback } from 'grammy';
import { Bot, webhookCallback } from '../../src/index.js';
import { honoFetchWebhook } from '../../examples/webhook-frameworks.mjs';
import { frameworks, frameworkServer } from './servers.js';
import { postUpdate, unwrapCallback, deferred, settled } from './requests.js';

const botInfo = { id: 123, is_bot: true, first_name: 'Framework' };

for (const name of frameworks) {
  test(
    `installed ${name} rejects owned update byte overflow before middleware`,
    { timeout: 10000 },
    async () => {
      const bot = new Bot('123:framework', { botInfo });
      let updates = 0;
      bot.use(() => updates++);
      const callback = webhookCallback(bot, name, {
        secretToken: 'secret',
        maxBytes: 256,
      });
      const server = await frameworkServer(name, callback);
      try {
        const response = await postUpdate(server, {
          body: JSON.stringify({ update_id: 1, padding: 'x'.repeat(512) }),
        });
        assert.equal(response.status, 500);
        assert.match(response.body, /Webhook body exceeds byte limit/);
        assert.equal(updates, 0);
      } finally {
        await server.close();
      }
    }
  );

  for (const reference of [true, false]) {
    for (const onTimeout of ['return', 'throw']) {
      test(
        `installed ${name} ${reference ? 'actual grammY' : 'owned'} ${onTimeout} deadline closes the response`,
        { timeout: 10000 },
        async () => {
          const Constructor = reference ? ActualBot : Bot;
          const callbackFactory = reference ? actualCallback : webhookCallback;
          const bot = new Constructor('123:framework', { botInfo });
          const release = deferred();
          const finished = deferred();
          let completed = false;
          bot.use(async () => {
            await release.promise;
            completed = true;
            finished.resolve();
          });
          const callback = callbackFactory(bot, name, {
            secretToken: 'secret',
            timeoutMilliseconds: 10,
            onTimeout,
          });
          const server = await frameworkServer(name, unwrapCallback(callback));
          try {
            const response = await postUpdate(server);
            assert.equal(response.status, onTimeout === 'return' ? 200 : 500);
            assert.equal(completed, false);
            if (onTimeout === 'throw') {
              assert.match(response.body, /Request timed out after 10 ms/);
            } else {
              assert.equal(response.body, '');
            }
          } finally {
            release.resolve();
            try {
              await settled(finished.promise);
            } finally {
              await server.close();
            }
          }
          assert.equal(completed, true);
        }
      );
    }
  }
}

for (const reference of [true, false]) {
  test(
    `installed Hono returns a JSON object with the ${reference ? 'actual grammY' : 'owned'} Fetch adapter`,
    { timeout: 10000 },
    async () => {
      const Constructor = reference ? ActualBot : Bot;
      const callbackFactory = reference ? actualCallback : webhookCallback;
      const bot = new Constructor('123:framework', {
        botInfo,
        client: { canUseWebhookReply: () => true },
      });
      bot.use((context) => context.api.sendMessage(7, 'Hono Fetch reply'));
      const callback = callbackFactory(bot, 'cloudflare-mod', {
        secretToken: 'secret',
      });
      const server = await frameworkServer('hono', honoFetchWebhook(callback));
      try {
        const response = await postUpdate(server);
        assert.equal(response.status, 200);
        assert.deepEqual(JSON.parse(response.body), {
          method: 'sendMessage',
          chat_id: 7,
          text: 'Hono Fetch reply',
        });
      } finally {
        await server.close();
      }
    }
  );
}
