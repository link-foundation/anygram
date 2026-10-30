import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Bot, InputFile } from '../src/index.js';
import { uploadServer } from './fixtures/bot-upload-server.js';
import { selectedBotClient, botRequestFields } from './fixtures/bot-client.js';

const token = 'positional:fixture';
const styles = ['native', 'grammy', 'telegraf', 'node-telegram-bot-api'];
const permissions = Object.freeze({ can_send_messages: false });
const rich = Object.freeze({ rows: [{ text: 'rich' }] });
const cases = [
  ['getChat', [7], { chat_id: 7 }],
  ['getChat', [{ chat_id: 7 }], { chat_id: 7 }],
  ['forwardMessage', [7, 8, 9], { chat_id: 7, from_chat_id: 8, message_id: 9 }],
  [
    'restrictChatMember',
    [7, 8, permissions],
    { chat_id: 7, user_id: 8, permissions },
  ],
  [
    'sendPoll',
    [7, 'choose', ['yes', { text: 'no' }]],
    {
      chat_id: 7,
      question: 'choose',
      options: [{ text: 'yes' }, { text: 'no' }],
    },
  ],
  [
    'editMessageCaptionInline',
    ['inline', { caption: 'caption' }],
    { inline_message_id: 'inline', caption: 'caption' },
  ],
  ['kickChatMember', [7, 8], { chat_id: 7, user_id: 8 }],
  ['getChatMembersCount', [7], { chat_id: 7 }],
  [
    'editEphemeralMessageText',
    [7, 8, 'ephemeral', rich],
    {
      chat_id: 7,
      receiver_user_id: 8,
      ephemeral_message_id: 'ephemeral',
      rich_message: rich,
    },
  ],
  [
    'sendMediaGroup',
    [7, [{ type: 'photo', media: 'remote-file-id' }]],
    { chat_id: 7, media: [{ type: 'photo', media: 'remote-file-id' }] },
  ],
];
const aliases = {
  kickChatMember: 'banChatMember',
  getChatMembersCount: 'getChatMemberCount',
  editMessageCaptionInline: 'editMessageCaption',
};

for (const backend of styles) {
  it(`sends positional, inline, alias and raw calls through actual ${backend} HTTP`, async () => {
    const server = await uploadServer({ maxRequests: cases.length });
    try {
      const bot = new Bot(token, {
        api: await selectedBotClient(backend, server.root, token),
      });
      const reason = new Error('cancel before dispatch');
      await assert.rejects(
        bot.api.getChat(7, globalThis.AbortSignal.abort(reason)),
        (error) => error === reason || error.cause === reason
      );
      assert.equal(server.requests.length, 0);
      for (const [method, args, expected] of cases) {
        const before = globalThis.structuredClone(args);
        assert.equal(await bot.api[method](...args), true);
        const request = server.requests.at(-1);
        assert.equal(request.url.split('/').at(-1), aliases[method] ?? method);
        assert.deepEqual(botRequestFields(request), expected);
        assert.deepEqual(args, before);
      }
      assert.equal(server.requests.length, cases.length);
    } finally {
      await server.close();
    }
  });

  it(`bounds nested positional upload preparation before ${backend} dispatch`, async () => {
    const bot = new Bot(token, {
      api: await selectedBotClient(backend, undefined, token),
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
          bot.api.sendMediaGroup(7, media, { timeout: 15 }),
          new Promise((resolve, reject) => {
            watchdog = globalThis.setTimeout(
              () => reject(new Error('Nested positional upload was unbounded')),
              200
            );
          }),
        ]),
        /timed out/i
      );
      assert.equal(media[0].type, 'photo');
    } finally {
      release([]);
      globalThis.clearTimeout(watchdog);
    }
  });
}
