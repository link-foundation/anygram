import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { BotApi } from '../src/index.js';
import { HttpTransport } from '../src/mtproto.js';

const json = (value, status = 200) =>
  new Response(JSON.stringify(value), { status });

const clients = (fetcher) => [
  {
    client: new BotApi({ token: '123:secret', fetch: fetcher }),
    request(options) {
      return this.client.getMe(options);
    },
  },
  {
    client: new HttpTransport({ fetch: fetcher }),
    request(options) {
      return this.client.request(new Uint8Array(), options);
    },
  },
];

describe('HTTP transport resource boundaries', () => {
  it('does not invoke fetch for cancelled requests or invalid deadlines', async () => {
    let fetched = 0;
    for (const client of clients(async () => {
      fetched++;
      return json({ ok: true, result: {} });
    })) {
      await assert.rejects(
        client.request({ signal: globalThis.AbortSignal.abort() })
      );
      for (const timeout of [-1, 0, NaN, Infinity, 2147483648]) {
        await assert.rejects(client.request({ timeout }), /timeout/i);
      }
    }
    assert.equal(fetched, 0);
  });

  it('rejects HTTP failures and malformed Bot API envelopes', async () => {
    for (const [envelope, status] of [
      [{ ok: true, result: 'incorrect success' }, 500],
      [null, 200],
      [[], 200],
      [{ result: {} }, 200],
    ]) {
      const client = new BotApi({
        token: '123:secret',
        fetch: async () => json(envelope, status),
      });
      await assert.rejects(client.getMe(), (error) => {
        assert.equal(error.type, 'INVALID_RESPONSE');
        assert.equal(error.code, status);
        return true;
      });
    }
  });

  it('bounds Bot API JSON and file bodies and releases their readers', async () => {
    for (const kind of ['json', 'file']) {
      let cancelled = false;
      const body = new globalThis.ReadableStream(
        {
          start(controller) {
            controller.enqueue(
              new globalThis.TextEncoder().encode('       {}')
            );
          },
          pull(controller) {
            controller.close();
          },
          cancel() {
            cancelled = true;
          },
        },
        { highWaterMark: 0 }
      );
      const client = new BotApi({
        token: '123:secret',
        maxResponseBytes: kind === 'json' ? 8 : 1024,
        fetch: async (url) =>
          kind === 'file' && url.endsWith('/getFile')
            ? json({ ok: true, result: { file_path: 'photos/file.jpg' } })
            : new Response(body),
      });
      const request =
        kind === 'json'
          ? client.getMe()
          : client.downloadMedia('file', { maxBytes: 8 });
      await assert.rejects(request, (error) => {
        assert.equal(error.type, 'RESPONSE_TOO_LARGE');
        return true;
      });
      assert(cancelled);
      assert.equal(body.locked, false);
    }
  });

  it('cancels and releases an MTProto body when its per-request deadline expires', async () => {
    let cancelled = false;
    let closeBody;
    const body = new globalThis.ReadableStream({
      start(controller) {
        closeBody = () => controller.close();
      },
      cancel() {
        cancelled = true;
      },
    });
    const client = new HttpTransport({ fetch: async () => new Response(body) });
    let watchdog;
    try {
      await assert.rejects(
        Promise.race([
          client.request(new Uint8Array(), { timeout: 10 }),
          new Promise((resolve, reject) => {
            watchdog = globalThis.setTimeout(
              () => reject(new Error('Request deadline was not enforced')),
              100
            );
          }),
        ]),
        (error) => error.name === 'AbortError'
      );
      assert(cancelled);
      assert.equal(body.locked, false);
      assert.equal(client.controllers.size, 0);
    } finally {
      globalThis.clearTimeout(watchdog);
      client.close();
      if (!cancelled) {
        closeBody();
      }
    }
  });

  it('checks content lengths early and releases MTProto readers after success and overflow', async () => {
    for (const advertised of [false, true]) {
      let read = 0;
      let cancelled = false;
      const body = new globalThis.ReadableStream(
        {
          pull(controller) {
            read++;
            controller.enqueue(new Uint8Array(9));
          },
          cancel() {
            cancelled = true;
          },
        },
        { highWaterMark: 0 }
      );
      const client = new HttpTransport({
        maxBytes: 8,
        fetch: async () =>
          new Response(body, {
            headers: advertised ? { 'content-length': '9' } : {},
          }),
      });
      await assert.rejects(client.request(new Uint8Array()));
      assert(cancelled);
      assert.equal(body.locked, false);
      assert.equal(read, advertised ? 0 : 1);
    }
    const result = new Response(new Uint8Array([1, 2, 3]));
    const client = new HttpTransport({ fetch: async () => result });
    assert.deepEqual([...(await client.request(new Uint8Array()))], [1, 2, 3]);
    assert.equal(result.body.locked, false);
  });
});
