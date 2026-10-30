import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Telegraf, InputFile } from '../src/index.js';
import { uploadServer } from './fixtures/bot-upload-server.js';
import { selectedBotClient, botRequestFields } from './fixtures/bot-client.js';

const calls = [
  [
    'forwardMessage',
    [7, 8, 9, { disable_notification: true }],
    { chat_id: 7, from_chat_id: 8, message_id: 9, disable_notification: true },
  ],
  [
    'answerCbQuery',
    ['callback', 'updated', { show_alert: true }],
    { callback_query_id: 'callback', text: 'updated', show_alert: true },
  ],
  [
    'sendQuiz',
    [7, 'Question?', ['yes', 'no'], { correct_option_id: 0 }],
    {
      chat_id: 7,
      question: 'Question?',
      options: ['yes', 'no'],
      type: 'quiz',
      correct_option_id: 0,
    },
  ],
  [
    'sendInvoice',
    [
      7,
      {
        title: 'Invoice',
        payload: 'order',
        currency: 'USD',
        prices: [{ label: 'item', amount: 100 }],
      },
    ],
    {
      chat_id: 7,
      title: 'Invoice',
      payload: 'order',
      currency: 'USD',
      prices: [{ label: 'item', amount: 100 }],
    },
  ],
  [
    'sendCopy',
    [7, { chat: { id: 8 }, message_id: 9 }],
    { chat_id: 7, from_chat_id: 8, message_id: 9 },
  ],
  [
    'setChatMenuButton',
    [{ chatId: 7, menuButton: { type: 'commands' } }],
    { chat_id: 7, menu_button: { type: 'commands' } },
  ],
  [
    'editMessageCaption',
    [7, 9, undefined, 'caption'],
    { chat_id: 7, message_id: 9, caption: 'caption' },
  ],
  [
    'editMessageMedia',
    [7, 9, undefined, { type: 'photo', media: 'file-id' }],
    { chat_id: 7, message_id: 9, media: { type: 'photo', media: 'file-id' } },
  ],
  [
    'setGameScore',
    [8, 100, undefined, 7, 9],
    {
      user_id: 8,
      score: 100,
      chat_id: 7,
      message_id: 9,
      disable_edit_message: false,
      force: false,
    },
  ],
  [
    'getUpdates',
    [30, 10, 2, ['callback_query']],
    { timeout: 30, limit: 10, offset: 2, allowed_updates: ['callback_query'] },
  ],
  ['getChat', [{ chat_id: 7 }], { chat_id: 7 }],
];
const alias = {
  sendQuiz: 'sendPoll',
  sendCopy: 'copyMessage',
  answerCbQuery: 'answerCallbackQuery',
};

for (const backend of [
  'native',
  'grammy',
  'telegraf',
  'node-telegram-bot-api',
]) {
  it(`routes Telegraf positional fields and file metadata through actual ${backend} HTTP`, async () => {
    const server = await uploadServer({
      maxRequests: calls.length + 1,
      result: (request) =>
        request.url.endsWith('/getFile')
          ? { file_path: 'docs/example.pdf' }
          : true,
    });
    try {
      const token = 'telegraf:wire';
      const bot = new Telegraf(token, {
        api: await selectedBotClient(backend, server.root, token),
      });
      const before = globalThis.structuredClone(calls);
      for (const [method, args] of calls) {
        await bot.telegram[method](...args);
      }
      assert.deepEqual(calls, before);
      const link = await bot.telegram.getFileLink('file-id');
      assert.equal(
        String(link),
        `${server.root}/file/bot${token}/docs/example.pdf`
      );
      assert.deepEqual(
        server.requests.map((request) => ({
          method: request.url.split('/').at(-1),
          params: botRequestFields(request),
        })),
        [
          ...calls.map(([method, , params]) => ({
            method: alias[method] ?? method,
            params,
          })),
          { method: 'getFile', params: { file_id: 'file-id' } },
        ]
      );
      const controller = new globalThis.AbortController();
      const reason = new Error('cancelled positional dispatch');
      controller.abort(reason);
      await assert.rejects(
        bot.telegram.forwardMessage(7, 8, 9, { signal: controller.signal }),
        (error) => error === reason || error.cause === reason
      );
      await assert.rejects(
        bot.telegram.getFileLink(
          { file_path: 'docs/cached.pdf' },
          controller.signal
        ),
        (error) => error === reason || error.cause === reason
      );
      assert.equal(server.requests.length, calls.length + 1);
    } finally {
      await server.close();
    }
  });

  it(`bounds Telegraf nested upload preparation through ${backend}`, async () => {
    const bot = new Telegraf('telegraf:deadline', {
      api: await selectedBotClient(
        backend,
        'http://127.0.0.1:1',
        'telegraf:deadline'
      ),
    });
    let release;
    const blocked = new Promise((resolve) => {
      release = resolve;
    });
    const media = Object.freeze([
      Object.freeze({
        type: 'photo',
        media: new InputFile(() => blocked, 'bounded.bin'),
      }),
    ]);
    let watchdog;
    try {
      await assert.rejects(
        Promise.race([
          bot.telegram.sendMediaGroup(7, media, { timeout: 15 }),
          new Promise((resolve, reject) => {
            watchdog = globalThis.setTimeout(
              () => reject(new Error('Telegraf upload was unbounded')),
              200
            );
          }),
        ]),
        /timed out/i
      );
    } finally {
      release([]);
      globalThis.clearTimeout(watchdog);
    }
  });
}
