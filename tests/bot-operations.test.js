import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { BotApi, createClient, InputFile, bold } from '../src/index.js';
import { uploadServer } from './fixtures/bot-upload-server.js';

const styles = ['native', 'grammy', 'telegraf', 'node-telegram-bot-api'];
const token = 'vendor:fixture';
const chat = 9007199254740993n;
const from = -1001234567890n;
const formatted = bold('hello');

function payload({ headers, body }) {
  if (headers['content-encoding'] === 'gzip') {
    body = gunzipSync(body, { maxOutputLength: 64 * 1024 });
  }
  if (headers['content-type'].includes('application/json')) {
    return JSON.parse(body.toString());
  }
  assert.match(headers['content-type'], /application\/x-www-form-urlencoded/);
  return Object.fromEntries(
    [...new globalThis.URLSearchParams(body.toString())].map(([key, value]) => [
      key,
      ['message_id', 'message_ids', 'entities', 'caption_entities'].includes(
        key
      )
        ? JSON.parse(value)
        : value,
    ])
  );
}

function clientFor(style, root) {
  const clientOptions = {
    grammy: { client: { apiRoot: root } },
    telegraf: { telegram: { apiRoot: root } },
    'node-telegram-bot-api': { apiRoot: root, maxRetries: 0 },
  }[style];
  return createClient({
    token,
    backend: style,
    native: style === 'native',
    libraries: style === 'native' ? [] : [style],
    baseUrl: root,
    clientOptions,
    timeout: 250,
  });
}

function calls(api, options) {
  return [
    () => api.getMe(options),
    () => api.sendMessage(chat, formatted, options),
    () => api.editMessage(chat, { id: 2, text: formatted, ...options }),
    () => api.deleteMessages(chat, [2, 3], options),
    () =>
      api.forwardMessages(chat, {
        fromPeer: from,
        messages: [2, 3],
        ...options,
      }),
    () =>
      api.sendFile(chat, {
        file: 'remote-file-id',
        caption: formatted,
        ...options,
      }),
  ];
}

for (const style of styles) {
  it(`routes all six high-level bot operations through the actual ${style} backend`, async () => {
    const server = await uploadServer();
    try {
      const api = await clientFor(style, server.root);
      const options = {
        signal: globalThis.AbortSignal.timeout(3000),
        timeout: 2000,
      };
      for (const call of calls(api, options)) {
        assert.equal(await call(), true);
      }
      assert.deepEqual(
        server.requests.map((request) => ({
          method: request.url.split('/').at(-1),
          params: payload(request),
        })),
        [
          { method: 'getMe', params: {} },
          {
            method: 'sendMessage',
            params: {
              chat_id: chat.toString(),
              text: 'hello',
              entities: formatted.entities,
            },
          },
          {
            method: 'editMessageText',
            params: {
              chat_id: chat.toString(),
              message_id: 2,
              text: 'hello',
              entities: formatted.entities,
            },
          },
          {
            method: 'deleteMessages',
            params: { chat_id: chat.toString(), message_ids: [2, 3] },
          },
          {
            method: 'forwardMessages',
            params: {
              chat_id: chat.toString(),
              from_chat_id: from.toString(),
              message_ids: [2, 3],
            },
          },
          {
            method: 'sendDocument',
            params: {
              chat_id: chat.toString(),
              document: 'remote-file-id',
              caption: 'hello',
              caption_entities: formatted.entities,
            },
          },
        ]
      );
    } finally {
      await server.close();
    }
  });

  it(`cancels all high-level ${style} bot operations before dispatch`, async () => {
    const server = await uploadServer();
    try {
      const api = await clientFor(style, server.root);
      const reason = new Error('high-level call cancelled');
      const signal = globalThis.AbortSignal.abort(reason);
      for (const call of calls(api, { signal })) {
        await assert.rejects(call(), (error) => error.cause === reason);
      }
      assert.equal(server.requests.length, 0);
    } finally {
      await server.close();
    }
  });

  it(`applies the ${style} sendFile deadline during owned source preparation`, async () => {
    const server = await uploadServer();
    let watchdog, release;
    const source = new Promise((resolve) => {
      release = resolve;
    });
    try {
      const api = await clientFor(style, server.root);
      const pending = api.sendFile(chat, {
        file: new InputFile(() => source),
        timeout: 10,
      });
      await assert.rejects(
        Promise.race([
          pending,
          new Promise((resolve, reject) => {
            watchdog = globalThis.setTimeout(
              () => reject(new Error('Per-call deadline was ignored')),
              150
            );
          }),
        ]),
        /timed out/
      );
      assert.equal(server.requests.length, 0);
    } finally {
      release(new Uint8Array([1]));
      globalThis.clearTimeout(watchdog);
      await server.close();
    }
  });
}

it('keeps direct native helper cancellation controls out of Bot API payloads', async () => {
  let requests = 0;
  const api = new BotApi({
    token,
    fetch: async () => {
      requests++;
      return new Response(JSON.stringify({ ok: true, result: true }));
    },
  });
  const reason = new Error('direct helper cancelled');
  const signal = globalThis.AbortSignal.abort(reason);
  for (const call of calls(api, { signal })) {
    await assert.rejects(call(), (error) => error === reason);
  }
  assert.equal(requests, 0);
});

it('preserves grammY cancellation signatures for all pinned zero-payload methods', async () => {
  const server = await uploadServer();
  const methods = [
    'getMe',
    'getWebhookInfo',
    'getForumTopicIconStickers',
    'getAvailableGifts',
    'logOut',
    'close',
    'getMyStarBalance',
    'removeMyProfilePhoto',
  ];
  try {
    const api = await clientFor('grammy', server.root);
    for (const method of methods) {
      assert.equal(
        await api.callBotApi(
          method,
          {},
          {
            // Match the wire tests' budget instead of the short fixture default.
            timeout: 2000,
            signal: globalThis.AbortSignal.timeout(3000),
          }
        ),
        true
      );
    }
    assert.deepEqual(
      server.requests.map((request) => ({
        method: request.url.split('/').at(-1),
        params: payload(request),
      })),
      methods.map((method) => ({ method, params: {} }))
    );
  } finally {
    await server.close();
  }
});

it('merges explicit sendMessage options after embedded text options', async () => {
  const server = await uploadServer();
  try {
    const api = await clientFor('native', server.root);
    await api.sendMessage(
      chat,
      { message: 'hello', disable_notification: false },
      { disable_notification: true, protect_content: true }
    );
    const payload = JSON.parse(server.requests[0].body.toString());
    assert.equal(payload.disable_notification, true);
    assert.equal(payload.protect_content, true);
    assert.equal(payload.message, undefined);
  } finally {
    await server.close();
  }
});
