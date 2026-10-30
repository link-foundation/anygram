import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { InputFile } from '../src/index.js';
import { collectUploads } from '../src/bot-api-upload.js';
import {
  agentBot,
  agentServer,
  tracedAgent,
} from './fixtures/telegraf-agent.js';
import { multipartFields } from './fixtures/bot-upload-server.js';
import { readFile } from 'node:fs/promises';
import { telegrafStartupStage } from './fixtures/telegraf-server.js';

for (const nested of [false, true]) {
  it(`uploads Telegraf URL wrappers with the independent source agent, nested ${nested}`, async () => {
    const api = await agentServer({ tls: false });
    const source = await agentServer({
      handle: (_request, response) => response.end('URL bytes'),
    });
    const tracked = tracedAgent(source.cert);
    try {
      const bot = agentBot(false, {
        apiRoot: `${api.root}/`,
        attachmentAgent: tracked.agent,
      });
      const file = Object.freeze({
        url: `${source.root}/source`,
        filename: 'url.txt',
      });
      const markup = {
        inline_keyboard: [[{ text: 'Web', web_app: { url: source.root } }]],
      };
      if (nested) {
        await bot.telegram.sendMediaGroup(7, [
          { type: 'document', media: file },
        ]);
      } else {
        await bot.telegram.sendDocument(7, file, { reply_markup: markup });
      }
      assert.deepEqual(tracked.paths, ['/source']);
      const fields = multipartFields(api.requests[0]);
      const reference = nested
        ? JSON.parse(fields.get('media'))[0].media
        : fields.get('document');
      const uploaded = fields.get(reference.slice('attach://'.length));
      assert.equal(uploaded.name, 'url.txt');
      assert.equal(
        new globalThis.TextDecoder().decode(uploaded.bytes),
        'URL bytes'
      );
      if (!nested) {
        assert.deepEqual(JSON.parse(fields.get('reply_markup')), markup);
      }
    } finally {
      tracked.agent.destroy();
      await source.close();
      await api.close();
    }
  });
}

it('retains ordinary URL wire objects without opening an upload source', () => {
  const params = {
    link_preview_options: { url: 'https://example.org/preview' },
    reply_markup: {
      inline_keyboard: [
        [{ text: 'Web', web_app: { url: 'https://example.org/app' } }],
      ],
    },
  };
  assert.deepEqual(collectUploads(params), { fields: params, files: [] });
});

it('recognizes every upload slot from the pinned official method and model facts', async () => {
  const names = new Set();
  for (const [file, collection] of [
    ['method', 'methods'],
    ['model', 'models'],
  ]) {
    const data = JSON.parse(
      await readFile(
        new globalThis.URL(
          `../docs/case-studies/issue-1/data/bot-api/${file}-facts.json`,
          import.meta.url
        ),
        'utf8'
      )
    );
    for (const entry of data[collection]) {
      for (const field of entry.fields) {
        if (field.upload || field.type.includes('InputFile')) {
          names.add(field.name);
        }
      }
    }
  }
  assert.equal(names.size, 13);
  for (const name of names) {
    const result = collectUploads({
      [name]: { url: 'https://example.org/file' },
    });
    assert.equal(result.files.length, 1, name);
    assert.equal(result.fields[name], 'attach://file0', name);
  }
});

it('selects the attachment agent again for each HTTPS to HTTP redirect', async () => {
  const api = await agentServer({ tls: false });
  const target = await agentServer({
    tls: false,
    handle: (_request, response) => response.end('redirected'),
  });
  const source = await agentServer({
    handle: (_request, response) => {
      response.writeHead(302, { location: `${target.root}/target` });
      response.end();
    },
  });
  const tracked = tracedAgent(source.cert);
  const urls = [];
  try {
    const bot = agentBot(false, {
      apiRoot: `${api.root}/`,
      attachmentAgent: (url) => {
        urls.push([url.protocol, url.pathname]);
        return url.protocol === 'https:' ? tracked.agent : undefined;
      },
    });
    await bot.telegram.sendDocument(
      7,
      new InputFile(new globalThis.URL(`${source.root}/start`))
    );
    assert.deepEqual(urls, [
      ['https:', '/start'],
      ['http:', '/target'],
    ]);
    assert.equal(target.requests.length, 1);
    assert.equal(api.requests.length, 1);
  } finally {
    tracked.agent.destroy();
    await source.close();
    await target.close();
    await api.close();
  }
});

for (const status of [404, 503]) {
  it(`rejects attachment HTTP ${status} before contacting the Bot API`, async () => {
    const api = await agentServer({ tls: false });
    const source = await agentServer({
      handle: (_request, response) => {
        response.writeHead(status).end('failed');
      },
    });
    const tracked = tracedAgent(source.cert);
    try {
      const bot = agentBot(false, {
        apiRoot: `${api.root}/`,
        attachmentAgent: tracked.agent,
      });
      await assert.rejects(
        bot.telegram.sendDocument(
          7,
          new InputFile(new globalThis.URL(source.root))
        ),
        new RegExp(`HTTP ${status}`)
      );
      assert.equal(tracked.paths.length, 1);
      assert.equal(api.requests.length, 0);
    } finally {
      tracked.agent.destroy();
      await source.close();
      await api.close();
    }
  });
}

for (const sourceUpload of [false, true]) {
  it(`closes an overflowing ${sourceUpload ? 'attachment' : 'API'} response without waiting for its end`, async () => {
    let closed;
    const disconnected = new Promise((resolve) => {
      closed = resolve;
    });
    const api = await agentServer({ tls: false });
    const peer = await agentServer({
      handle: (request, response) => {
        request.socket.once('close', closed);
        response.write('x'.repeat(1024));
      },
    });
    const tracked = tracedAgent(peer.cert);
    try {
      const bot = agentBot(
        false,
        {
          apiRoot: `${sourceUpload ? api.root : peer.root}/`,
          agent: tracked.agent,
          attachmentAgent: tracked.agent,
        },
        { maxResponseBytes: 128, maxUploadBytes: 128 }
      );
      const pending = sourceUpload
        ? bot.telegram.sendDocument(
            7,
            new InputFile(new globalThis.URL(peer.root))
          )
        : bot.telegram.getMe();
      await assert.rejects(pending, { type: 'RESPONSE_TOO_LARGE' });
      await telegrafStartupStage(disconnected);
      assert.equal(tracked.paths.length, 1);
      assert.equal(api.requests.length, 0);
    } finally {
      tracked.agent.destroy();
      await peer.close();
      await api.close();
    }
  });
}

it('bounds attachment redirects to twenty hops before the Bot API request', async () => {
  const api = await agentServer({ tls: false });
  const source = await agentServer({
    handle: (_request, response) => {
      response.writeHead(302, { location: '/loop' }).end();
    },
  });
  const tracked = tracedAgent(source.cert);
  try {
    const bot = agentBot(false, {
      apiRoot: `${api.root}/`,
      attachmentAgent: tracked.agent,
    });
    await assert.rejects(
      bot.telegram.sendDocument(
        7,
        new InputFile(new globalThis.URL(source.root))
      ),
      /redirect limit/
    );
    assert.equal(source.requests.length, 21);
    assert.equal(api.requests.length, 0);
  } finally {
    tracked.agent.destroy();
    await source.close();
    await api.close();
  }
});

for (const stage of ['headers', 'body']) {
  it(`cancels the attachment agent during ${stage} before opening the API connection`, async () => {
    let ready;
    let closed;
    const seen = new Promise((resolve) => {
      ready = resolve;
    });
    const disconnected = new Promise((resolve) => {
      closed = resolve;
    });
    const api = await agentServer({ tls: false });
    const source = await agentServer({
      handle: (request, response) => {
        request.socket.once('close', closed);
        if (stage === 'body') {
          response.write('partial');
        }
        ready();
      },
    });
    const tracked = tracedAgent(source.cert);
    const controller = new globalThis.AbortController();
    const reason = new Error('Cancel attachment');
    try {
      const bot = agentBot(false, {
        apiRoot: `${api.root}/`,
        attachmentAgent: tracked.agent,
      });
      const rejected = assert.rejects(
        bot.telegram.callApi(
          'sendDocument',
          {
            chat_id: 7,
            document: new InputFile(new globalThis.URL(source.root)),
          },
          { signal: controller.signal }
        ),
        (error) => error === reason
      );
      await telegrafStartupStage(seen);
      controller.abort(reason);
      await rejected;
      await telegrafStartupStage(disconnected);
      assert.equal(tracked.paths.length, 1);
      assert.equal(api.requests.length, 0);
    } finally {
      controller.abort(reason);
      tracked.agent.destroy();
      await source.close();
      await api.close();
    }
  });
}
