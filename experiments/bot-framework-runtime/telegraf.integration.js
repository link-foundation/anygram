import { test } from 'node:test';
import assert from 'node:assert/strict';
import { telegrafWebhookBot } from '../../tests/fixtures/telegraf-webhook.js';
import { frameworkServer } from './servers.js';
import { postUpdate } from './requests.js';
import { telegrafHandler } from './telegraf-handler.js';

const frameworks = ['express', 'koa', 'fastify'];

async function scenario(name, reference, mode) {
  const { bot, calls } = telegrafWebhookBot(reference, {
    telegram: { apiRoot: 'http://127.0.0.1:1' },
  });
  const updates = [];
  const errors = [];
  bot.catch((error) => {
    throw error;
  });
  bot.use(async (context) => {
    updates.push(context.update.update_id);
    if (mode === 'failure') {
      throw new Error('Telegraf framework handler failed');
    }
    if (mode === 'reply' || mode === 'concurrent') {
      await context.deleteMessage();
    }
  });
  const callback = bot.webhookCallback('/hook', { secretToken: 'secret' });
  const server = await frameworkServer(
    name,
    telegrafHandler(name, callback, errors)
  );
  try {
    const responses = await Promise.all(
      (mode === 'concurrent' ? [1, 2] : [1]).map((id) =>
        postUpdate(server, {
          id,
          mode,
          ...(!['malformed', 'oversized'].includes(mode) && {
            body: JSON.stringify({
              update_id: id,
              message: {
                message_id: id,
                date: 1,
                chat: { id: 7, type: 'private' },
              },
            }),
          }),
        })
      )
    );
    if (mode === 'reply' || mode === 'concurrent') {
      for (const response of responses) {
        response.body = JSON.parse(response.body);
      }
    }
    return { responses, updates: updates.sort(), errors, calls };
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
      `installed ${name} matches actual Telegraf webhook ${mode}`,
      { timeout: 10000 },
      async () => {
        const expected = await scenario(name, true, mode);
        const actual = await scenario(name, false, mode);
        assert.deepEqual(actual, expected);
        const status =
          {
            unauthorized: name === 'express' ? 404 : 403,
            malformed: 400,
            oversized: 413,
          }[mode] ?? 200;
        assert(
          actual.responses.every((response) => response.status === status)
        );
        assert.deepEqual(
          actual.updates,
          ['unauthorized', 'malformed', 'oversized'].includes(mode)
            ? []
            : mode === 'concurrent'
              ? [1, 2]
              : [1]
        );
        assert.deepEqual(actual.calls, []);
        assert.deepEqual(
          actual.errors,
          mode === 'failure' ? ['Telegraf framework handler failed'] : []
        );
        if (mode === 'reply' || mode === 'concurrent') {
          actual.responses.forEach((response, index) => {
            assert.deepEqual(response.body, {
              method: 'deleteMessage',
              chat_id: 7,
              message_id: index + 1,
            });
          });
        }
      }
    );
  }
}
