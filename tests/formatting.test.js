import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api } from 'telegram';
import {
  Anygram,
  Bot,
  BotApi,
  createAdapter,
  fmt,
  formatTemplate,
  bold,
  italic,
  code,
  link,
  FormattedText,
} from '../src/index.js';

it('preserves entities across runtime templates and counts emoji in UTF-16 (grammY #669)', () => {
  const name = bold('Ada 🚀');
  const template = fmt`👋 ${name}, ${italic('welcome')}!`;
  assert.equal(template.text, '👋 Ada 🚀, welcome!');
  assert.deepEqual(template.entities, [
    { type: 'bold', offset: 3, length: 6 },
    { type: 'italic', offset: 11, length: 7 },
  ]);
  const nested = bold(fmt`Hi ${italic('Ada')}`);
  assert.deepEqual(nested.entities, [
    { type: 'bold', offset: 0, length: 6 },
    { type: 'italic', offset: 3, length: 3 },
  ]);
  assert.equal(name.entities[0].offset, 0);
  assert.throws(() => {
    name.entities[0].offset = 99;
  }, TypeError);
});

it('interpolates localized strings loaded at runtime while retaining entity offsets', () => {
  const localized = JSON.parse('{"greeting":"👋 {name}! {{literal}} {name}"}');
  const result = formatTemplate(localized.greeting, { name: bold('Ada') });
  assert.equal(result.text, '👋 Ada! {literal} Ada');
  assert.deepEqual(
    result.entities.map((entity) => entity.offset),
    [3, 18]
  );
  assert.throws(
    () => formatTemplate('{missing}', {}),
    /Missing template value/
  );
});

it('supports paired format tags, incoming captions, and literal hostile markup', () => {
  const incoming = {
    caption: '🚀 go',
    caption_entities: [{ type: 'bold', offset: 3, length: 2 }],
  };
  const text = fmt`${bold}Hi ${italic}Ada${italic}${bold} ${incoming} <b>literal</b>`;
  assert.equal(text.text, 'Hi Ada 🚀 go <b>literal</b>');
  assert.deepEqual(text.entities, [
    { type: 'bold', offset: 0, length: 6 },
    { type: 'italic', offset: 3, length: 3 },
    { type: 'bold', offset: 10, length: 2 },
  ]);
  assert.equal(bold('hello \n').entities[0].length, 5);
  assert.throws(() => fmt`${bold}unclosed`, /unclosed/i);
  assert.throws(() => bold(code('invalid')), /nest/i);
  assert.throws(
    () => new FormattedText('a', [{ type: 'bold', offset: 0, length: 2 }]),
    /bounds/i
  );
});

it('sends and edits formatted bot text through the shared context and raw transport', async () => {
  const calls = [];
  const bot = new Bot('123:test', {
    fetch: async (url, options) => {
      calls.push(JSON.parse(options.body));
      return new Response(JSON.stringify({ ok: true, result: true }));
    },
  });
  bot.on('message', async (ctx) => {
    await ctx.reply(fmt`Hi ${bold('Ada')}`);
    await ctx.editMessageText(link('docs', 'https://example.com'));
  });
  await bot.handleUpdate({
    update_id: 1,
    message: { message_id: 2, chat: { id: 3 } },
  });
  assert.equal(calls[0].text, 'Hi Ada');
  assert.deepEqual(calls[0].entities, [{ type: 'bold', offset: 3, length: 3 }]);
  assert.equal(calls[1].entities[0].url, 'https://example.com');
  const transport = new BotApi({
    token: '123:test',
    fetch: async (url, options) => {
      const params = JSON.parse(options.body);
      assert.equal(params.caption, 'caption');
      assert.equal(params.caption_entities[0].type, 'italic');
      assert.equal(params.parse_mode, undefined);
      return new Response(JSON.stringify({ ok: true, result: true }));
    },
  });
  await transport.callApi('sendPhoto', {
    chat_id: 1,
    photo: 'file-id',
    caption: italic('caption'),
    parse_mode: 'HTML',
  });
});

it('translates formatted entities to canonical MTProto entities without reparsing markup', async () => {
  const client = new Anygram({
    adapters: [
      createAdapter('mtproto', {
        call: async (method, params) => {
          assert.equal(method, 'messages.sendMessage');
          assert.equal(params.message, '👋 Ada');
          assert.deepEqual(params.entities, [
            { _: 'messageEntityBold', offset: 3, length: 3 },
          ]);
          return { _: 'updateShortSentMessage', id: 1 };
        },
      }),
    ],
  });
  await client.sendMessage('me', fmt`👋 ${bold('Ada')}`);
});

it('reroutes formatted text through shared operations on a real GramJS schema', async () => {
  const client = new Anygram({
    adapters: [
      createAdapter(
        'gramjs',
        {
          sendMessage: () =>
            assert.fail('Formatted entities require shared translation'),
          invoke: async (request) => {
            assert.equal(request.className, 'messages.SendMessage');
            assert.equal(request.entities[0].className, 'MessageEntityBold');
            assert.equal(request.entities[0].offset, 3);
            assert.ok(request.getBytes().length > 0);
            return { _: 'updateShortSentMessage', id: 1 };
          },
        },
        { Api }
      ),
    ],
  });
  await client.sendMessage('me', fmt`👋 ${bold('Ada')}`);
});
