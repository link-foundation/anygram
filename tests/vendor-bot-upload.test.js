import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GrammyApi, InputFile as GrammyFile } from 'grammy';
import { Telegram } from 'telegraf';
import { Api as NodeApi, InputFile as NodeFile } from 'node-telegram-bot-api';
import {
  Anygram,
  createAdapter,
  createClient,
  InputFile,
} from '../src/index.js';
import { uploadServer, multipartFields } from './fixtures/bot-upload-server.js';

const bytes = new Uint8Array([65, 66, 67]);
const fixture = () =>
  uploadServer({
    trace: process.env.ANYGRAM_TRACE_UPLOAD ? console.error : undefined,
  });
function backend(style, root, options = {}) {
  const token = 'vendor:fixture';
  const vendor = {
    grammy: () => ({ api: new GrammyApi(token, { apiRoot: root }) }),
    telegraf: () => ({ telegram: new Telegram(token, { apiRoot: root }) }),
    'node-telegram-bot-api': () => ({
      api: new NodeApi(token, { apiRoot: root, maxRetries: 0 }),
    }),
  }[style]();
  const client = new Anygram({
    adapters: [createAdapter(style, vendor, options)],
  });
  const call = client.callBotApi.bind(client);
  client.callBotApi = (method, params, settings = {}) =>
    call(method, params, {
      signal: globalThis.AbortSignal.timeout(3000),
      ...settings,
    });
  return client;
}

function uploaded(request, field, nested = false) {
  assert.match(request.headers['content-type'], /multipart\/form-data/);
  const form = multipartFields(request);
  const value = nested ? JSON.parse(form.get(field))[0].media : form.get(field);
  const file = typeof value === 'string' ? form.get(value.slice(9)) : value;
  return {
    filename: file.name,
    bytes: file.bytes,
    form,
  };
}

for (const style of ['grammy', 'node-telegram-bot-api']) {
  it(`sends owned InputFile bytes and nested suppliers through actual ${style} multipart encoding`, async () => {
    const server = await fixture();
    try {
      const client = backend(style, server.root);
      const file = new InputFile(bytes, 'owned.bin');
      assert.equal(
        await client.callBotApi('sendDocument', { chat_id: 7, document: file }),
        true
      );
      await client.callBotApi('sendMediaGroup', {
        chat_id: 7,
        media: [
          {
            type: 'document',
            media: new InputFile(() => [bytes], 'nested.bin'),
            caption: 'attach://file0',
          },
        ],
      });
      assert.equal(server.requests.length, 2);
      const direct = await uploaded(server.requests[0], 'document');
      const nested = await uploaded(server.requests[1], 'media', true);
      assert.deepEqual(direct.bytes, bytes);
      assert.deepEqual(nested.bytes, bytes);
      assert.equal(direct.filename, 'owned.bin');
      assert.equal(nested.filename, 'nested.bin');
      assert.equal(
        JSON.parse(nested.form.get('media'))[0].caption,
        'attach://file0'
      );
      assert.equal(file.consumed, false);
    } finally {
      await server.close();
    }
  });

  it(`retains existing ${style} file inputs and plain remote IDs`, async () => {
    const server = await fixture();
    try {
      const client = backend(style, server.root);
      const document = {
        grammy: () => new GrammyFile(bytes, 'foreign.bin'),
        telegraf: () => ({
          source: Buffer.from(bytes),
          filename: 'foreign.bin',
        }),
        'node-telegram-bot-api': () =>
          new NodeFile(bytes, { filename: 'foreign.bin' }),
      }[style]();
      await client.callBotApi('sendDocument', { chat_id: 7, document });
      const file = await uploaded(server.requests[0], 'document');
      assert.deepEqual(file.bytes, bytes);
      assert.equal(file.filename, 'foreign.bin');
      await client.callBotApi('sendDocument', {
        chat_id: 7,
        document: 'remote-file-id',
      });
      const body = server.requests[1].body.toString();
      assert(body.includes('remote-file-id'));
      assert.equal(server.requests.length, 2);
    } finally {
      await server.close();
    }
  });
}

it('converts owned files at the actual Telegraf API boundary without changing literal attachment text', async () => {
  const telegram = new Telegram('vendor:fixture');
  const calls = [];
  telegram.callApi = async function (method, params, options) {
    assert.equal(this, telegram);
    calls.push({ method, params, signal: options.signal });
    return true;
  };
  const client = new Anygram({
    adapters: [createAdapter('telegraf', { telegram })],
  });
  const input = new InputFile(() => [bytes], 'owned.bin');
  await client.callBotApi('sendDocument', { document: input });
  await client.callBotApi('sendMediaGroup', {
    media: [{ type: 'document', media: input, caption: 'attach://file0' }],
  });
  assert.deepEqual(calls[0].params.document, {
    source: Buffer.from(bytes),
    filename: 'owned.bin',
  });
  assert.deepEqual(calls[1].params.media[0].media, calls[0].params.document);
  assert.equal(calls[1].params.media[0].caption, 'attach://file0');
  assert(calls.every(({ signal }) => signal instanceof globalThis.AbortSignal));
});

it('preserves Telegraf source wrappers, remote IDs and exact large chat IDs', async () => {
  const telegram = new Telegram('vendor:fixture');
  const calls = [];
  telegram.callApi = async (method, params) => {
    calls.push(params);
    return true;
  };
  const client = new Anygram({
    adapters: [createAdapter('telegraf', { telegram })],
  });
  await client.callBotApi('sendDocument', {
    chat_id: 9007199254740993n,
    document: { source: Buffer.from(bytes), filename: 'foreign.bin' },
  });
  await client.callBotApi('sendDocument', { document: 'remote-file-id' });
  assert.equal(calls[0].chat_id, '9007199254740993');
  assert.deepEqual(calls[0].document, {
    source: Buffer.from(bytes),
    filename: 'foreign.bin',
  });
  assert.equal(calls[1].document, 'remote-file-id');
});

for (const style of ['grammy', 'telegraf', 'node-telegram-bot-api']) {
  it(`rejects aggregate overflow and excessive structure before dispatching to ${style}`, async () => {
    const server = await fixture();
    let closed = 0,
      supplied = 0;
    function* stream() {
      try {
        yield bytes;
      } finally {
        closed++;
      }
    }
    try {
      const client = backend(style, server.root, { maxUploadBytes: 5 });
      await assert.rejects(
        client.callBotApi('sendMediaGroup', {
          media: [
            { type: 'document', media: new InputFile(bytes) },
            { type: 'document', media: new InputFile(stream()) },
          ],
        }),
        /byte limit/
      );
      assert.equal(closed, 1);
      let deep = null;
      for (let index = 0; index < 70; index++) {
        deep = { nested: deep };
      }
      await assert.rejects(
        client.callBotApi('sendDocument', {
          document: new InputFile(() => {
            supplied++;
            return bytes;
          }),
          deep,
        }),
        /depth limit/
      );
      assert.equal(supplied, 0);
      assert.equal(server.requests.length, 0);
    } finally {
      await server.close();
    }
  });

  it(`cancels blocked ${style} source preparation and closes a late stream`, async () => {
    const server = await fixture();
    const controller = new globalThis.AbortController();
    let entered, release;
    const ready = new Promise((resolve) => {
      entered = resolve;
    });
    const source = new Promise((resolve) => {
      release = resolve;
    });
    let closed = 0;
    try {
      const client = backend(style, server.root);
      const pending = client.callBotApi(
        'sendDocument',
        {
          document: new InputFile(() => {
            entered();
            return source;
          }),
        },
        { signal: controller.signal }
      );
      await ready;
      const reason = new Error('owned source cancelled');
      controller.abort(reason);
      await assert.rejects(pending, (error) => error.cause === reason);
      release({
        return() {
          closed++;
        },
        [Symbol.asyncIterator]() {
          return this;
        },
      });
      await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
      assert.equal(closed, 1);
      assert.equal(server.requests.length, 0);
    } finally {
      controller.abort();
      release(bytes);
      await server.close();
    }
  });

  it(`passes upload limits through automatic ${style} construction`, async () => {
    const client = await createClient({
      token: 'vendor:fixture',
      native: false,
      libraries: [style],
      backend: style,
      maxUploadBytes: 2,
    });
    assert.equal(client.capabilities()[0].name, style);
    await assert.rejects(
      client.callBotApi('sendDocument', { document: new InputFile(bytes) }),
      /byte limit/
    );
  });
}

it('prepares legacy node-telegram-bot-api formData without serializing file sources as JSON', async () => {
  const calls = [];
  const legacy = {
    _request: async (...args) => {
      calls.push(args);
      return true;
    },
  };
  const client = new Anygram({
    adapters: [createAdapter('node-telegram-bot-api', legacy)],
  });
  await client.callBotApi('sendMediaGroup', {
    chat_id: 9007199254740993n,
    media: [{ type: 'document', media: new InputFile(bytes, 'legacy.bin') }],
  });
  const [method, { form, formData }] = calls[0];
  assert.equal(method, 'sendMediaGroup');
  assert.equal(form.chat_id, '9007199254740993');
  const reference = JSON.parse(form.media)[0].media;
  const file = formData[reference.slice(9)];
  assert.deepEqual(file.value, Buffer.from(bytes));
  assert.equal(file.options.filename, 'legacy.bin');
  assert.equal(calls.length, 1);
});

it('keeps a request deadline active through a noncooperating selected vendor request', async () => {
  for (const style of ['grammy', 'telegraf', 'node-telegram-bot-api']) {
    let release, observed;
    const pending = new Promise((resolve) => {
      release = resolve;
    });
    const request = (method, params, options) => {
      observed = options?.signal ?? options;
      return pending;
    };
    const vendor = {
      grammy: {
        api: {
          raw: {
            sendDocument: (params, signal) =>
              request('sendDocument', params, signal),
          },
        },
      },
      telegraf: { telegram: { callApi: request } },
      'node-telegram-bot-api': { api: { request } },
    }[style];
    const adapter = createAdapter(style, vendor);
    const controller = new globalThis.AbortController();
    const watchdog = globalThis.setTimeout(
      () => controller.abort(new Error('Finite vendor probe expired')),
      500
    );
    try {
      await assert.rejects(
        adapter.bot(
          'sendDocument',
          { document: new InputFile(bytes) },
          {
            signal: controller.signal,
            timeout: 10,
          }
        ),
        /timed out/
      );
      assert.equal(observed.aborted, true);
    } finally {
      globalThis.clearTimeout(watchdog);
      release(true);
    }
  }
});
