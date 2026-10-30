import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { BotApi } from '../src/index.js';

const success = () => new Response(JSON.stringify({ ok: true, result: true }));
const forbidden = () => assert.fail('Invalid upload reached the transport');

it('uploads Telegraf-style buffered sources and Blob thumbnails as attachments', async () => {
  const bytes = new Uint8Array([1, 2, 3]);
  const media = {
    type: 'animation',
    media: { source: bytes, filename: 'terminal.gif' },
    thumbnail: { source: new globalThis.Blob(['PNG']), filename: 'thumb.png' },
  };
  const api = new BotApi({
    token: 'upload:test',
    fetch: async (url, { body }) => {
      assert(body instanceof FormData);
      const [item] = JSON.parse(body.get('media'));
      const file = body.get(item.media.slice(9));
      assert.equal(file.name, 'terminal.gif');
      assert.deepEqual(new Uint8Array(await file.arrayBuffer()), bytes);
      assert.equal(await body.get(item.thumbnail.slice(9)).text(), 'PNG');
      return success();
    },
  });
  await api.callApi('sendMediaGroup', { chat_id: 7, media: [media] });
  assert.equal(media.media.source, bytes);
  assert.equal(media.media.filename, 'terminal.gif');
});

it('limits aggregate attachment bytes before fetch and preserves the exact boundary', async () => {
  let calls = 0;
  const api = new BotApi({
    token: 'upload:test',
    maxUploadBytes: 5,
    fetch: async () => {
      calls++;
      return success();
    },
  });
  const attachment = () => ({ data: new Uint8Array(3) });
  await assert.rejects(
    api.callApi('sendMediaGroup', { media: [attachment(), attachment()] }),
    /upload.*byte limit/i
  );
  assert.equal(calls, 0);
  await api.callApi('sendDocument', { document: new Uint8Array(5) });
  assert.equal(calls, 1);
});

it('checks Blob size and finite file count before building a multipart body', async () => {
  const api = new BotApi({
    token: 'upload:test',
    maxUploadBytes: 2,
    fetch: forbidden,
  });
  await assert.rejects(
    api.callApi('sendDocument', { document: new globalThis.Blob(['abc']) }),
    /upload.*byte limit/i
  );
  await assert.rejects(
    api.callApi('sendMediaGroup', {
      media: Array.from({ length: 1001 }, () => new Uint8Array()),
    }),
    /upload.*file limit/i
  );
});

it('bounds upload object nesting before visiting deep getters', async () => {
  let visited = false;
  let value = {
    get file() {
      visited = true;
      return new Uint8Array();
    },
  };
  for (let index = 0; index < 70; index++) {
    value = { child: value };
  }
  const api = new BotApi({ token: 'upload:test', fetch: forbidden });
  await assert.rejects(api.callApi('sendDocument', value), /depth limit/i);
  assert.equal(visited, false);
});

it('rejects oversized sparse upload vectors without reading their entries', async () => {
  let visited = false;
  const media = new Array(100001);
  Object.defineProperty(media, 0, {
    get() {
      visited = true;
      return {};
    },
  });
  const api = new BotApi({ token: 'upload:test', fetch: forbidden });
  await assert.rejects(
    api.callApi('sendMediaGroup', { media }),
    /vector length/i
  );
  assert.equal(visited, false);
});

it('validates upload limits and observes pre-cancellation before walking inputs', async () => {
  for (const maxUploadBytes of [-1, NaN, Infinity, 0.5]) {
    assert.throws(
      () => new BotApi({ token: 'upload:test', maxUploadBytes }),
      /maxBytes/
    );
  }
  const controller = new globalThis.AbortController();
  const reason = new Error('cancelled before upload preparation');
  controller.abort(reason);
  const api = new BotApi({ token: 'upload:test', fetch: forbidden });
  await assert.rejects(
    api.callApi(
      'sendDocument',
      {
        get document() {
          return assert.fail('Cancelled upload was traversed');
        },
      },
      { signal: controller.signal }
    ),
    (error) => error === reason
  );
});
