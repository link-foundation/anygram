import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Bot as ActualBot, webhookCallback as actualCallback } from 'grammy';
import { Bot, webhookCallback } from '../../src/index.js';
import { frameworks, frameworkServer } from './servers.js';
import { postUpdate, unwrapCallback } from './requests.js';

const botInfo = {
  id: 123,
  is_bot: true,
  first_name: 'Framework',
  username: 'framework_bot',
};

async function scenario(name, reference, mode) {
  const bot = new (reference ? ActualBot : Bot)('123:framework', {
    botInfo,
    client: { canUseWebhookReply: () => true },
  });
  bot.botInfo = botInfo;
  let initialization = 0;
  bot.init = async () => {
    initialization++;
    await Promise.resolve();
  };
  const updates = [];
  bot.use(async (context) => {
    updates.push(context.update.update_id);
    if (mode === 'failure') {
      throw new Error('Framework handler failed');
    }
    if (mode === 'reply' || mode === 'concurrent') {
      await context.api.sendMessage(
        7,
        `framework reply ${context.update.update_id}`
      );
    }
  });
  const makeCallback = reference ? actualCallback : webhookCallback;
  const callback = makeCallback(bot, name, {
    secretToken: 'secret',
    timeoutMilliseconds: 1000,
  });
  // grammY wraps webhook failures without invoking its polling catcher. The
  // shared Bot catcher also handles direct dispatch. Unwrap at the HTTP boundary
  // so this comparison tests framework delivery rather than that known extension.
  const server = await frameworkServer(name, unwrapCallback(callback));
  try {
    const responses = await Promise.all(
      (mode === 'concurrent' ? [1, 2] : [1]).map((id) =>
        postUpdate(server, { id, mode })
      )
    );
    return {
      responses,
      updates: updates.sort(),
      initialization,
    };
  } finally {
    await server.close();
  }
}

for (const name of frameworks) {
  for (const mode of [
    'reply',
    'empty',
    'unauthorized',
    'concurrent',
    'failure',
    'malformed',
    'oversized',
  ]) {
    test(
      `installed ${name} matches actual grammY webhook ${mode}`,
      { timeout: 10000 },
      async () => {
        const expected = await scenario(name, true, mode);
        const actual = await scenario(name, false, mode);
        // The SDK may call init twice when HTTP requests overlap before the
        // first await settles. The owned callback shares one in-flight task.
        const { initialization: referenceInitializations, ...referenceResult } =
          expected;
        const { initialization, ...result } = actual;
        assert.deepEqual(result, referenceResult);
        assert(
          referenceInitializations >= initialization &&
            referenceInitializations <= (mode === 'concurrent' ? 2 : 1)
        );
        const status =
          {
            unauthorized: 401,
            failure: 500,
            malformed: name === 'hono' ? 500 : 400,
            oversized: 413,
          }[mode] ?? 200;
        for (const response of actual.responses) {
          assert.equal(response.status, status);
        }
        const ids = ['unauthorized', 'malformed', 'oversized'].includes(mode)
          ? []
          : mode === 'concurrent'
            ? [1, 2]
            : [1];
        assert.deepEqual(actual.updates, ids);
        if (!['malformed', 'oversized'].includes(mode)) {
          assert.equal(initialization, 1);
        }
        if (mode === 'reply' || mode === 'concurrent') {
          for (const [index, response] of actual.responses.entries()) {
            const value = JSON.parse(response.body);
            // The SDK's Hono adapter JSON-encodes the already serialized payload.
            const payload = name === 'hono' ? JSON.parse(value) : value;
            assert.deepEqual(payload, {
              method: 'sendMessage',
              chat_id: 7,
              text: `framework reply ${index + 1}`,
            });
          }
        }
      }
    );
  }
}
