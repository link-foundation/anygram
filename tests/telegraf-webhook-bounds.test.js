import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  telegrafWebhookBot,
  telegrafWebhookRequest,
  telegrafWebhookResponse,
} from './fixtures/telegraf-webhook.js';

for (const form of ['object', 'string', 'buffer', 'stream']) {
  it(`bounds Telegraf ${form} bodies before initialization or dispatch`, async () => {
    const { bot, calls } = telegrafWebhookBot(false);
    bot.botInfo = undefined;
    let handled = 0;
    bot.use(() => {
      handled++;
    });
    const { response } = telegrafWebhookResponse();
    await bot.webhookCallback('/hook', { maxBytes: 8 })(
      telegrafWebhookRequest(form),
      response
    );
    assert.equal(response.statusCode, 413);
    assert.equal(response.writableEnded, true);
    assert.deepEqual(calls, []);
    assert.equal(handled, 0);
  });
}

it('rejects unauthenticated requests without reading their bodies or initializing', async () => {
  const { bot, calls } = telegrafWebhookBot(false);
  bot.botInfo = undefined;
  const request = telegrafWebhookRequest('object', { headers: {} });
  Object.defineProperty(request, 'body', {
    get() {
      throw new Error('Unauthorized body read');
    },
  });
  const { response } = telegrafWebhookResponse();
  await bot.webhookCallback('/hook', { secretToken: 'secret' })(
    request,
    response
  );
  assert.equal(response.statusCode, 403);
  assert.deepEqual(calls, []);
});

it('cancels unfinished Telegraf body collection and releases its listeners at the deadline', async () => {
  const { bot } = telegrafWebhookBot(false);
  const stream = Object.assign(new PassThrough(), {
    method: 'POST',
    url: '/hook',
    headers: {},
  });
  const { response } = telegrafWebhookResponse();
  let guard;
  try {
    await assert.rejects(
      Promise.race([
        bot.webhookCallback('/hook', { timeoutMilliseconds: 10 })(
          stream,
          response
        ),
        new Promise((_, reject) => {
          guard = globalThis.setTimeout(
            () => reject(new Error('Unbounded webhook callback')),
            500
          );
        }),
      ]),
      /Request timed out/
    );
    for (const event of ['data', 'end', 'error', 'aborted']) {
      assert.equal(stream.listenerCount(event), 0);
    }
    assert.equal(response.writableEnded, true);
  } finally {
    stream.destroy();
    globalThis.clearTimeout(guard);
  }
});

it('does not dispatch after callback initialization has exceeded its deadline', async () => {
  const { bot } = telegrafWebhookBot(false);
  bot.botInfo = undefined;
  let release;
  const initialized = new Promise((resolve) => {
    release = resolve;
  });
  bot.api.getMe = () => initialized;
  let handled = 0;
  bot.use(() => {
    handled++;
  });
  const { response } = telegrafWebhookResponse();
  try {
    await assert.rejects(
      bot.webhookCallback('/hook', { timeoutMilliseconds: 5 })(
        telegrafWebhookRequest(),
        response
      ),
      /Request timed out/
    );
    assert.equal(response.writableEnded, true);
  } finally {
    release({ id: 123 });
  }
  await initialized;
  await Promise.resolve();
  assert.equal(handled, 0);
});

it('preserves middleware syntax errors instead of treating them as malformed request bodies', async () => {
  const { bot } = telegrafWebhookBot(false);
  const failure = new SyntaxError('application failure');
  bot.use(() => {
    throw failure;
  });
  const { response } = telegrafWebhookResponse();
  await assert.rejects(
    bot.webhookCallback('/hook')(telegrafWebhookRequest(), response),
    failure
  );
  assert.equal(response.statusCode, 200);
  assert.equal(response.writableEnded, true);
});

it('rejects invalid Telegraf body/deadline controls before touching requests', () => {
  const { bot } = telegrafWebhookBot(false);
  for (const options of [
    { maxBytes: -1 },
    { timeoutMilliseconds: -1 },
    { timeoutMilliseconds: 2147483648 },
  ]) {
    assert.throws(() => bot.webhookCallback('/hook', options), RangeError);
  }
});
