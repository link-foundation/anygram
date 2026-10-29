import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Telegram as OriginalTelegram } from 'telegraf';
import * as owned from '../src/index.js';
import { agentBot } from './fixtures/telegraf-agent.js';
import { uploadServer } from './fixtures/bot-upload-server.js';
import { telegrafWebhookResponse } from './fixtures/telegraf-webhook.js';

function constructor(reference) {
  const value = reference ? OriginalTelegram : owned.Telegram;
  assert.equal(
    typeof value,
    'function',
    'Public Telegram constructor is missing'
  );
  return value;
}

async function standaloneScenario(reference, withResponse = false) {
  const server = await uploadServer();
  const { response, snapshot } = telegrafWebhookResponse();
  try {
    const Telegram = constructor(reference);
    const api = new Telegram(
      '123:standalone',
      {
        apiRoot: `${server.root}/prefix/`,
        apiMode: 'user',
        testEnv: true,
      },
      withResponse ? response : undefined
    );
    const results = [];
    results.push(await api.sendMessage(7, 'standalone'));
    results.push(await api.sendChatAction(7, 'typing'));
    results.push(await api.sendChatAction(7, 'upload_document'));
    const file = await api.getFileLink({ file_path: 'documents/file.txt' });
    return {
      token: api.token,
      instance: api instanceof Telegram,
      response: api.response === (withResponse ? response : undefined),
      paths: server.requests.map(({ url }) => url),
      file: String(file).replace(server.root, 'ROOT'),
      results,
      ...(withResponse && { webhook: snapshot() }),
    };
  } finally {
    await server.close();
  }
}

for (const withResponse of [false, true]) {
  it(`matches actual standalone Telegram method and webhook construction, response ${withResponse}`, async () => {
    const reference = await standaloneScenario(true, withResponse);
    assert.equal(reference.paths.length, withResponse ? 2 : 3);
    assert.equal(reference.instance, true);
    assert.equal(reference.response, true);
    assert.deepEqual(await standaloneScenario(false, withResponse), reference);
  });
}

it('retains Telegram instances for the global bot and each scoped update view', async () => {
  const Telegram = constructor(false);
  const { response } = telegrafWebhookResponse();
  const bot = agentBot(false, undefined, {
    api: { callApi: async () => true },
  });
  const contexts = [];
  bot.use((ctx) => {
    contexts.push(ctx.telegram);
  });
  await bot.handleUpdate({ update_id: 1 }, response);
  await bot.handleUpdate({ update_id: 2 });
  for (const api of [bot.telegram, ...contexts]) {
    assert.ok(api instanceof Telegram);
    assert.equal(api.constructor, Telegram);
  }
  assert.equal(contexts[0].response, response);
  assert.equal(contexts[1].response, undefined);
});

it('supports standalone Telegram subclasses without losing their prototype', async () => {
  const Telegram = constructor(false);
  class CustomTelegram extends Telegram {
    label() {
      return this.token;
    }
  }
  const api = new CustomTelegram('123:subclass');
  assert.ok(api instanceof Telegram);
  assert.ok(api instanceof CustomTelegram);
  assert.equal(api.label(), '123:subclass');
});

for (const scoped of [false, true]) {
  it(`honors subclass method overrides and later instance replacements, response ${scoped}`, async () => {
    const Telegram = constructor(false);
    class CustomTelegram extends Telegram {
      async getMe() {
        return this.token;
      }
    }
    const { response } = telegrafWebhookResponse();
    const api = new CustomTelegram(
      '123:override',
      {
        api: { callApi: async () => 'backend' },
      },
      scoped ? response : undefined
    );
    assert.equal(await api.getMe(), '123:override');
    api.getMe = async () => 'instance';
    assert.equal(await api.getMe(), 'instance');
  });
}

it('lets subclass overrides delegate to shared base methods through super', async () => {
  const Telegram = constructor(false);
  class CustomTelegram extends Telegram {
    async sendMessage(chat, text, options) {
      return super.sendMessage(chat, `custom ${text}`, options);
    }
  }
  const calls = [];
  const api = new CustomTelegram('123:super', {
    api: {
      callApi: async (...args) => {
        calls.push(args);
        return true;
      },
    },
  });
  assert.equal(await api.sendMessage(7, 'message'), true);
  assert.deepEqual(calls[0].slice(0, 2), [
    'sendMessage',
    { chat_id: 7, text: 'custom message' },
  ]);
});

it('routes inherited positional methods through overridden callApi like actual Telegram', async () => {
  const outcomes = [];
  for (const reference of [true, false]) {
    const Telegram = constructor(reference);
    class CustomTelegram extends Telegram {
      async callApi(method, params) {
        return { method, params };
      }
    }
    const api = new CustomTelegram('123:dispatch', {
      apiRoot: 'http://127.0.0.1:1/',
    });
    outcomes.push([await api.getMe(), await api.sendMessage(7, 'inherited')]);
  }
  assert.deepEqual(outcomes[1], outcomes[0]);
});

it('resolves standalone file links through overridden getFile like actual Telegram', async () => {
  const outcomes = [];
  for (const reference of [true, false]) {
    const Telegram = constructor(reference);
    class CustomTelegram extends Telegram {
      async getFile(id) {
        return { file_id: id, file_path: 'files/custom.txt' };
      }
    }
    const api = new CustomTelegram('123:files', {
      apiRoot: 'http://127.0.0.1:1/',
    });
    outcomes.push(String(await api.getFileLink('custom')));
  }
  assert.deepEqual(outcomes[1], outcomes[0]);
});

it('routes standalone Telegram through a selected backend and mutable webhook settings', async () => {
  const Telegram = constructor(false);
  const calls = [];
  const { response, snapshot } = telegrafWebhookResponse();
  const api = new Telegram(
    '123:selected',
    {
      api: {
        callApi: async (method, params) => {
          calls.push([method, params]);
          return true;
        },
      },
    },
    response
  );
  api.webhookReply = false;
  await api.sendChatAction(7, 'typing');
  assert.equal(response.writableEnded, false);
  api.options.webhookReply = true;
  await api.sendChatAction(7, 'typing');
  assert.equal(snapshot().body.method, 'sendChatAction');
  assert.deepEqual(calls, [
    ['sendChatAction', { chat_id: 7, action: 'typing' }],
  ]);
});

it('uses a standalone explicit fetch hook and validates native settings before fetching', async () => {
  const Telegram = constructor(false);
  let calls = 0;
  const options = {
    fetch: async () => {
      calls++;
      return Response.json({ ok: true, result: true });
    },
  };
  await new Telegram('123:fetch', options).sendMessage(7, 'Hello');
  assert.equal(calls, 1);
  assert.throws(
    () => new Telegram('123:fetch', { ...options, apiMode: 'invalid' }),
    TypeError
  );
  assert.equal(calls, 1);
});
