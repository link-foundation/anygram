import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { webhookReplyScenario } from './fixtures/webhook-reply.js';
import {
  frameworkNames,
  frameworkScenario,
} from './fixtures/webhook-framework.js';

for (const name of frameworkNames) {
  for (const mode of ['reply', 'empty', 'unauthorized']) {
    it(`matches actual grammY ${name} webhook ${mode}`, async () => {
      const expected = await frameworkScenario(name, true, mode);
      const actual = await frameworkScenario(name, false, mode);
      assert.deepEqual(actual, expected);
    });
  }
}

it('keeps the selected webhook method authoritative over untyped payload fields', async () => {
  const probe = (reference) =>
    webhookReplyScenario(
      'grammy',
      reference,
      async (bot, dispatch) => {
        bot.use((ctx) =>
          ctx.api.raw.sendMessage({
            chat_id: 7,
            text: 'safe',
            method: 'deleteMessage',
          })
        );
        await dispatch();
      },
      { client: { canUseWebhookReply: () => true } }
    );
  const expected = await probe(true);
  const result = await probe(false);
  assert.deepEqual(result, expected);
  assert.equal(result.bodies[0].method, 'sendMessage');
});
