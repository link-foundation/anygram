import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Bot } from '../src/index.js';
import {
  telegrafWebhookBot,
  webhookUpdate,
} from './fixtures/telegraf-webhook.js';

function enhancedResponse() {
  const response = {
    writableEnded: false,
    headersSent: false,
    headers: {},
    sent: [],
    ended: [],
    setHeader(name, value) {
      this.headers[name.toLowerCase()] = value;
    },
    send(body) {
      this.sent.push(body);
      this.writableEnded = true;
    },
    end(body) {
      this.ended.push(body);
      this.writableEnded = true;
    },
  };
  return response;
}

it('uses the Node JSON response contract when a framework also provides send', async () => {
  for (const reference of [true, false]) {
    const { bot, calls } = telegrafWebhookBot(reference);
    const response = enhancedResponse();
    bot.use((context) => context.deleteMessage());
    await bot.handleUpdate(webhookUpdate, response);
    assert.deepEqual(response.sent, []);
    assert.equal(response.ended.length, 1);
    assert.deepEqual(response.headers, { 'content-type': 'application/json' });
    assert.deepEqual(JSON.parse(response.ended[0]), {
      method: 'deleteMessage',
      chat_id: 7,
      message_id: 9,
    });
    assert.deepEqual(calls, []);
  }
});

it('retains Node response authority for direct shared Bot webhook replies', async () => {
  const bot = new Bot('123:response', {
    botInfo: { id: 123, is_bot: true, first_name: 'Response' },
    client: { canUseWebhookReply: () => true },
  });
  const response = enhancedResponse();
  bot.use((context) => context.api.sendMessage(7, 'Node JSON response'));
  await bot.handleUpdate(webhookUpdate, response);
  assert.deepEqual(response.sent, []);
  assert.equal(response.ended.length, 1);
  assert.equal(response.headers['content-type'], 'application/json');
  assert.deepEqual(JSON.parse(response.ended[0]), {
    method: 'sendMessage',
    chat_id: 7,
    text: 'Node JSON response',
  });
});

it('retains the envelope send contract without Node header methods', async () => {
  const bot = new Bot('123:response', {
    botInfo: { id: 123, is_bot: true, first_name: 'Response' },
    client: { canUseWebhookReply: () => true },
  });
  const sent = [];
  let ended = 0;
  bot.use((context) => context.api.sendMessage(7, 'Envelope response'));
  await bot.handleUpdate(webhookUpdate, {
    send: (body) => sent.push(JSON.parse(body)),
    end: () => ended++,
  });
  assert.deepEqual(sent, [
    { method: 'sendMessage', chat_id: 7, text: 'Envelope response' },
  ]);
  assert.equal(ended, 1);
});
