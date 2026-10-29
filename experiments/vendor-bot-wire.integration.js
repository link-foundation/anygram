import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Telegram } from 'telegraf';
import { Anygram, createAdapter, InputFile } from '../src/index.js';
import {
  uploadServer,
  multipartFields,
} from '../tests/fixtures/bot-upload-server.js';
import {
  agentBot,
  agentServer,
  tracedAgent,
} from '../tests/fixtures/telegraf-agent.js';

// Telegraf 4's sandwich-stream stalls on newer Node and Bun: retain this
// actual wire integration on the Node 20 CI runner, with a separate reproducer.
for (const owned of [true, false]) {
  test(`actual Telegraf multipart wire: ${owned ? 'owned supplier' : 'existing wrapper'}`, async () => {
    const server = await uploadServer();
    const bytes = new Uint8Array([65, 0, 255, 67]);
    try {
      const telegram = new Telegram('vendor:fixture', { apiRoot: server.root });
      const client = new Anygram({
        adapters: [createAdapter('telegraf', { telegram })],
      });
      const file = () =>
        owned
          ? new InputFile(() => [bytes], 'wire.bin')
          : { source: Buffer.from(bytes), filename: 'wire.bin' };
      for (const nested of [false, true]) {
        await client.callBotApi(
          nested ? 'sendMediaGroup' : 'sendDocument',
          {
            chat_id: 7,
            ...(nested
              ? { media: [{ type: 'document', media: file() }] }
              : { document: file() }),
          },
          { signal: globalThis.AbortSignal.timeout(3000) }
        );
        const fields = multipartFields(server.requests.at(-1));
        const value = nested
          ? JSON.parse(fields.get('media'))[0].media
          : fields.get('document');
        const uploaded =
          typeof value === 'string' ? fields.get(value.slice(9)) : value;
        assert.equal(uploaded.name, 'wire.bin');
        assert.deepEqual(uploaded.bytes, bytes);
      }
      assert.equal(server.requests.length, 2);
    } finally {
      await server.close();
    }
  });
}

for (const nested of [false, true]) {
  test(`actual Telegraf attachment-agent URL wire, nested ${nested}`, async () => {
    const outcomes = [];
    for (const reference of [true, false]) {
      const api = await agentServer({ tls: false });
      const source = await agentServer({
        handle: (_request, response) => response.end('wire source'),
      });
      const tracked = tracedAgent(source.cert);
      const urls = [];
      try {
        const bot = agentBot(reference, {
          apiRoot: `${api.root}/`,
          attachmentAgent: (url) => {
            urls.push(url.pathname);
            return tracked.agent;
          },
        });
        const file = { url: `${source.root}/source`, filename: 'wire.txt' };
        if (nested) {
          await bot.telegram.sendMediaGroup(7, [
            { type: 'document', media: file },
          ]);
        } else {
          await bot.telegram.sendDocument(7, file);
        }
        const fields = multipartFields(api.requests[0]);
        const value = nested
          ? JSON.parse(fields.get('media'))[0].media
          : fields.get('document');
        const uploaded =
          typeof value === 'string' ? fields.get(value.slice(9)) : value;
        outcomes.push({ agent: tracked.paths, urls, uploaded });
      } finally {
        tracked.agent.destroy();
        await source.close();
        await api.close();
      }
    }
    assert.deepEqual(outcomes[1], outcomes[0]);
    assert.deepEqual(outcomes[0].agent, ['/source']);
    assert.deepEqual(outcomes[0].urls, ['/source']);
    assert.equal(outcomes[0].uploaded.name, 'wire.txt');
  });
}
