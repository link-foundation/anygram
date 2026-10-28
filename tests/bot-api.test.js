import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { BotApi, Anygram, createAdapter, TelegramError } from '../src/index.js';

const response = (result) =>
  new Response(JSON.stringify({ ok: true, result }), {
    headers: { 'content-type': 'application/json' },
  });

describe('native Bot API', () => {
  it('keeps timeouts active until the response body has been consumed', async () => {
    const api = new BotApi({
      token: '123:secret',
      timeout: 10,
      fetch: async (url, { signal }) => ({
        status: 200,
        json: () =>
          new Promise((resolve, reject) => {
            signal.addEventListener(
              'abort',
              () => reject(new Error('secret URL')),
              { once: true }
            );
          }),
      }),
    });
    let watchdog;
    const result = Promise.race([
      api.getMe(),
      new Promise((resolve, reject) => {
        watchdog = globalThis.setTimeout(
          () => reject(new Error('Body timeout was not enforced')),
          100
        );
      }),
    ]);
    try {
      await assert.rejects(result, /timed out/);
    } finally {
      globalThis.clearTimeout(watchdog);
    }
  });
  it('calls arbitrary methods without competitor packages and preserves IDs', async () => {
    const requests = [];
    const native = new BotApi({
      token: '123:secret',
      fetch: async (url, options) => {
        requests.push([url, options]);
        return response({ id: 42 });
      },
    });
    const client = new Anygram({
      adapters: [createAdapter('native', native, { kind: 'bot' })],
    });
    await client.api.setMyCommands({
      commands: [{ command: 'start', description: 'Start' }],
    });
    await client.sendMessage(-1001234567890n, 'hello', { parse_mode: 'HTML' });
    assert.equal(
      requests[0][0],
      'https://api.telegram.org/bot123:secret/setMyCommands'
    );
    assert.deepEqual(JSON.parse(requests[1][1].body), {
      chat_id: '-1001234567890',
      text: 'hello',
      parse_mode: 'HTML',
    });
  });

  it('uploads nested media using multipart attachments', async () => {
    const native = new BotApi({
      token: '123:secret',
      fetch: async (url, { body }) => {
        assert(body instanceof FormData);
        const media = JSON.parse(body.get('media'));
        assert.match(media[0].media, /^attach:\/\//);
        const file = body.get(media[0].media.slice(9));
        assert.equal(file.name, 'photo.png');
        assert.deepEqual(
          new Uint8Array(await file.arrayBuffer()),
          new Uint8Array([1, 2, 3])
        );
        return response([]);
      },
    });
    await native.callApi('sendMediaGroup', {
      chat_id: 1,
      media: [
        {
          type: 'photo',
          media: { data: new Uint8Array([1, 2, 3]), filename: 'photo.png' },
        },
      ],
    });
  });

  it('surfaces flood waits without silently retrying a send', async () => {
    let calls = 0;
    const native = new BotApi({
      token: '123:secret',
      fetch: async () => {
        calls++;
        return new Response(
          JSON.stringify({
            ok: false,
            error_code: 429,
            description: 'Too Many Requests',
            parameters: { retry_after: 12 },
          }),
          { status: 429 }
        );
      },
    });
    await assert.rejects(
      native.sendMessage(1, 'hello'),
      (error) =>
        error instanceof TelegramError &&
        error.retryAfter === 12 &&
        error.code === 429
    );
    assert.equal(calls, 1);
  });

  it('redacts tokens from network errors', async () => {
    const native = new BotApi({
      token: '123:secret',
      fetch: async (url) => {
        throw new Error(`Failed to fetch ${url}`);
      },
    });
    await assert.rejects(native.getMe(), (error) => {
      assert(!String(error).includes('secret'));
      assert(!String(error.cause).includes('secret'));
      return true;
    });
  });

  it('downloads bot files using the configured server', async () => {
    const native = new BotApi({
      token: '123:secret',
      baseUrl: 'http://localhost:8081',
      fetch: async (url) =>
        url.includes('/getFile')
          ? response({ file_path: 'photos/file.jpg' })
          : new Response(new Uint8Array([4, 5])),
    });
    assert.deepEqual(
      await native.downloadMedia('file-id'),
      new Uint8Array([4, 5])
    );
  });
});
