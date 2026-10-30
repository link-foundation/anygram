import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Agent } from 'node:http';
import { gzipSync, deflateSync, brotliCompressSync } from 'node:zlib';
import { InputFile } from '../src/index.js';
import {
  agentBot,
  agentScenario,
  agentServer,
  tracedAgent,
} from './fixtures/telegraf-agent.js';
import { multipartFields } from './fixtures/bot-upload-server.js';
import { telegrafStartupStage } from './fixtures/telegraf-server.js';

it('exposes the actual Telegraf default HTTPS agent and shared keep-alive pool', async () => {
  const facts = (reference) => {
    const first = agentBot(reference).telegram.options.agent;
    const next = agentBot(reference).telegram.options.agent;
    return {
      agent: first instanceof Agent,
      keepAlive: first?.keepAlive,
      keepAliveMsecs: first?.keepAliveMsecs,
      shared: first === next,
    };
  };
  assert.deepEqual(facts(false), facts(true));
});

it('clears even an explicitly supplied API agent for an HTTP root like actual Telegraf', () => {
  const agent = new Agent();
  try {
    const options = { apiRoot: 'http://127.0.0.1:1/', agent };
    assert.equal(agentBot(true, options).telegram.options.agent, undefined);
    assert.equal(agentBot(false, options).telegram.options.agent, undefined);
  } finally {
    agent.destroy();
  }
});

for (const mutate of [false, true]) {
  it(`uses the actual HTTPS agent for global and update calls, mutation ${mutate}`, async () => {
    const reference = await agentScenario(true, mutate);
    const owned = await agentScenario(false, mutate);
    assert.equal(owned.first.length, mutate ? 2 : 3);
    assert.equal(owned.second.length, mutate ? 1 : 0);
    if (globalThis.Bun) {
      // Bun's node-fetch shim bypasses Agent.addRequest; assert the divergence.
      assert.deepEqual(reference.first, []);
      assert.deepEqual(reference.second, []);
      assert.deepEqual({ ...owned, first: [], second: [] }, reference);
    } else {
      assert.deepEqual(owned, reference);
    }
  });
}

it('keeps selected backends authoritative when unused native agents would throw', async () => {
  let calls = 0;
  const bot = agentBot(
    false,
    {
      agent: {
        addRequest: () => assert.fail('Selected backend used native agent'),
      },
      attachmentAgent: () => assert.fail('Selected backend read an attachment'),
    },
    {
      api: { callApi: async () => ++calls },
    }
  );
  assert.equal(await bot.telegram.sendMessage(7, 'selected'), 1);
  assert.equal(calls, 1);
});

it('keeps an explicit fetch transport authoritative over the default agent', async () => {
  let calls = 0;
  const bot = agentBot(false, undefined, {
    fetch: async () => {
      calls++;
      return Response.json({ ok: true, result: 'custom' });
    },
  });
  assert.equal(await bot.telegram.sendMessage(7, 'selected'), 'custom');
  assert.equal(calls, 1);
});

for (const factory of [false, true]) {
  it(`uses a separate attachment agent for bounded URL uploads, factory ${factory}`, async () => {
    const api = await agentServer({ tls: false });
    const source = await agentServer({
      handle: (_request, response) => response.end('source bytes'),
    });
    const tracked = tracedAgent(source.cert);
    const urls = [];
    try {
      const attachmentAgent = factory
        ? (url) => {
            urls.push(url.pathname);
            return tracked.agent;
          }
        : tracked.agent;
      const bot = agentBot(false, {
        apiRoot: `${api.root}/`,
        attachmentAgent,
      });
      await bot.telegram.sendDocument(
        7,
        new InputFile(new globalThis.URL(`${source.root}/source`), 'source.txt')
      );
      assert.deepEqual(tracked.paths, ['/source']);
      assert.deepEqual(urls, factory ? ['/source'] : []);
      const fields = multipartFields(api.requests[0]);
      assert.equal(
        new globalThis.TextDecoder().decode(fields.get('file0').bytes),
        'source bytes'
      );
      assert.equal(fields.get('file0').name, 'source.txt');
    } finally {
      tracked.agent.destroy();
      await source.close();
      await api.close();
    }
  });
}

for (const coding of ['identity', 'gzip', 'deflate', 'br']) {
  it(`reads ${coding} responses through an API agent under the native byte limit`, async () => {
    const content = Buffer.from(
      JSON.stringify({ ok: true, result: 'x'.repeat(2048) })
    );
    const server = await agentServer({
      handle: (_request, response) => {
        response.setHeader('content-encoding', coding);
        const encode = {
          gzip: gzipSync,
          deflate: deflateSync,
          br: brotliCompressSync,
        }[coding];
        response.end(encode ? encode(content) : content);
      },
    });
    const tracked = tracedAgent(server.cert);
    try {
      const telegram = { apiRoot: `${server.root}/`, agent: tracked.agent };
      const bot = agentBot(false, telegram);
      assert.equal((await bot.telegram.getMe()).length, 2048);
      const bounded = agentBot(false, telegram, { maxResponseBytes: 128 });
      await assert.rejects(bounded.telegram.getMe(), {
        type: 'RESPONSE_TOO_LARGE',
      });
      assert.equal(tracked.paths.length, 2);
    } finally {
      tracked.agent.destroy();
      await server.close();
    }
  });
}

for (const stage of ['headers', 'body']) {
  it(`cancels agent API sockets while awaiting ${stage} and redacts the token`, async () => {
    let ready;
    let closed;
    const seen = new Promise((resolve) => {
      ready = resolve;
    });
    const disconnected = new Promise((resolve) => {
      closed = resolve;
    });
    const server = await agentServer({
      handle: (request, response) => {
        request.socket.once('close', closed);
        if (stage === 'body') {
          response.write('{"ok":');
        }
        ready();
      },
    });
    const tracked = tracedAgent(server.cert);
    const controller = new globalThis.AbortController();
    try {
      const bot = agentBot(false, {
        apiRoot: `${server.root}/`,
        agent: tracked.agent,
      });
      const pending = bot.telegram.callApi(
        'getMe',
        {},
        { signal: controller.signal }
      );
      const rejected = assert.rejects(pending, (error) => {
        assert.equal(error.type, 'NETWORK_ERROR');
        assert.doesNotMatch(error.message, /123:agent/);
        return true;
      });
      await telegrafStartupStage(seen);
      controller.abort();
      await rejected;
      await telegrafStartupStage(disconnected);
      assert.equal(tracked.paths.length, 1);
    } finally {
      controller.abort();
      tracked.agent.destroy();
      await server.close();
    }
  });
}
