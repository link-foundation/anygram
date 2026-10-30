import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api, GrammyError } from 'grammy';
import { Telegram, TelegramError as TelegrafError } from 'telegraf';
import { Bot, Telegraf, BotApi, TelegramError, Context } from '../src/index.js';

const update = (inline = false) => ({
  update_id: 1,
  callback_query: {
    id: 'callback',
    from: { id: 8 },
    ...(inline
      ? { inline_message_id: 'inline:message' }
      : { message: { message_id: 9, chat: { id: 7 } } }),
  },
});
const success = () => new Response(JSON.stringify({ ok: true, result: true }));

it('matches the actual grammY text edit signature used by terminal output', async () => {
  const expected = [];
  const reference = new Api('oracle:test');
  reference.config.use((next, method, params, signal) => {
    expected.push({ method, params, signal });
    return Promise.resolve({ ok: true, result: true });
  });
  const signal = new globalThis.AbortController().signal;
  await reference.editMessageText(
    7,
    9,
    'terminal output',
    { parse_mode: 'Markdown' },
    signal
  );
  const actual = [];
  const transport = {
    callApi: (method, params, options) => {
      actual.push({ method, params, signal: options?.signal });
      return Promise.resolve(true);
    },
  };
  const bot = new Bot('terminal:test', { api: transport });
  await bot.api.editMessageText(
    7,
    9,
    'terminal output',
    { parse_mode: 'Markdown' },
    signal
  );
  assert.deepEqual(actual, expected);
});

it('preserves the actual Telegraf chat and inline edit signatures', async () => {
  const expected = [];
  const reference = new Telegram('oracle:test');
  reference.callApi = (method, params) => {
    expected.push({ method, params });
    return Promise.resolve(true);
  };
  await reference.editMessageText(7, 9, undefined, 'terminal output', {
    parse_mode: 'Markdown',
  });
  await reference.editMessageText(
    undefined,
    undefined,
    'inline:message',
    'inline output',
    {}
  );
  const actual = [];
  const bot = new Telegraf('terminal:test', {
    api: {
      callApi: (method, params) => {
        actual.push({ method, params });
        return Promise.resolve(true);
      },
    },
  });
  await bot.telegram.editMessageText(7, 9, undefined, 'terminal output', {
    parse_mode: 'Markdown',
  });
  await bot.telegram.editMessageText(
    undefined,
    undefined,
    'inline:message',
    'inline output',
    {}
  );
  assert.deepEqual(actual, expected);
});

it('edits inline messages through the grammY API and forwards cancellation', async () => {
  const calls = [];
  const signal = new globalThis.AbortController().signal;
  const bot = new Bot('inline:test', {
    api: {
      callApi: (method, params, options) => {
        calls.push({ method, params, options });
        return Promise.resolve(true);
      },
    },
  });
  await bot.api.editMessageTextInline(
    'inline:message',
    'text',
    { parse_mode: 'HTML' },
    signal
  );
  assert.deepEqual(calls, [
    {
      method: 'editMessageText',
      params: {
        inline_message_id: 'inline:message',
        text: 'text',
        parse_mode: 'HTML',
      },
      options: { signal },
    },
  ]);
});

for (const Constructor of [Bot, Telegraf]) {
  it(`routes ${Constructor.name} context edits independently of positional API style`, async () => {
    const calls = [];
    for (const inline of [false, true]) {
      const bot = new Constructor('context:test', {
        botInfo: { id: 123, username: 'testbot' },
        fetch: async (url, { body }) => {
          calls.push(JSON.parse(body));
          return success();
        },
      });
      bot.on('callback_query', (ctx) =>
        ctx.editMessageText('updated', { parse_mode: 'HTML' })
      );
      await bot.handleUpdate(update(inline));
    }
    assert.deepEqual(calls, [
      { chat_id: 7, message_id: 9, text: 'updated', parse_mode: 'HTML' },
      {
        inline_message_id: 'inline:message',
        text: 'updated',
        parse_mode: 'HTML',
      },
    ]);
  });
}

it('exposes structured Bot API failures for unchanged terminal edit recovery', async () => {
  const envelope = {
    ok: false,
    error_code: 400,
    description: 'Bad Request: message to edit not found',
  };
  let calls = 0;
  const api = new BotApi({
    token: 'terminal:test',
    fetch: async () => {
      calls++;
      return new Response(JSON.stringify(envelope), { status: 400 });
    },
  });
  await assert.rejects(api.callApi('editMessageText', {}), (error) => {
    assert(error instanceof TelegramError);
    assert.equal(error.error_code, 400);
    assert.equal(error.description, envelope.description);
    assert.equal(error.ok, false);
    assert.equal(error.method, 'editMessageText');
    assert.equal(error.response.error_code, 400);
    assert.deepEqual(error.parameters, {});
    return true;
  });
  assert.equal(calls, 1);
});

it('preserves actual grammY and Telegraf structured error data through normalization', () => {
  const envelope = {
    ok: false,
    error_code: 429,
    description: 'Too Many Requests',
    parameters: { retry_after: 12, migrate_to_chat_id: -100123 },
  };
  for (const error of [
    new GrammyError('Call failed', envelope, 'sendMessage', {}),
    new TelegrafError(envelope),
  ]) {
    const converted = TelegramError.from(error, 'oracle');
    assert.equal(converted.code, 429);
    assert.equal(converted.error_code, 429);
    assert.equal(converted.description, envelope.description);
    assert.equal(converted.retryAfter, 12);
    assert.equal(converted.migrateTo, -100123);
    assert.deepEqual(converted.parameters, envelope.parameters);
    assert.notEqual(converted.parameters, envelope.parameters);
    assert.equal(converted.cause, error);
  }
});

it('redacts tokens from all structured native Bot API error aliases', async () => {
  const api = new BotApi({
    token: '123:secret',
    fetch: async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 400,
          description: 'Invalid 123:secret',
        }),
        { status: 400 }
      ),
  });
  await assert.rejects(api.getMe(), (error) => {
    assert.equal(error.description, 'Invalid [redacted]');
    assert.equal(error.response.description, 'Invalid [redacted]');
    assert(!JSON.stringify(error).includes('123:secret'));
    return true;
  });
});

it('constructs a direct context with an independent Telegraf API view', async () => {
  const calls = [];
  const bot = new Bot('direct:test', {
    api: {
      callApi: (method, params) => {
        calls.push({ method, params });
        return Promise.resolve(true);
      },
    },
  });
  const ctx = new Context(update(), bot.api);
  await ctx.telegram.editMessageText(7, 9, undefined, 'direct', {});
  assert.deepEqual(calls, [
    {
      method: 'editMessageText',
      params: {
        chat_id: 7,
        message_id: 9,
        inline_message_id: undefined,
        text: 'direct',
      },
    },
  ]);
});
