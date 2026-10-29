import { createServer as httpServer } from 'node:http';
import { Agent, createServer as httpsServer } from 'node:https';
import { Telegraf as OriginalTelegraf } from 'telegraf';
import { Telegraf } from '../../src/index.js';
import { telegrafTlsOptions } from './telegraf-server.js';
import { webhookInfo } from './telegraf-webhook.js';
import { botRequestFields } from './bot-client.js';

/** Finite TLS/HTTP endpoints verify agent connections rather than option storage. */
export async function agentServer({ tls = true, handle } = {}) {
  const credentials = await telegrafTlsOptions();
  const requests = [];
  let accepted = 0;
  const listener = (request, response) => {
    if (++accepted > 32) {
      request.destroy();
      return;
    }
    const chunks = [];
    let length = 0;
    request.on('data', (chunk) => {
      length += chunk.length;
      if (length > 65536) {
        request.destroy();
      } else {
        chunks.push(chunk);
      }
    });
    request.on('error', () => response.destroy());
    request.on('end', () => {
      const entry = {
        url: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks),
      };
      requests.push(entry);
      if (handle) {
        handle(request, response, entry);
      } else {
        response.setHeader('content-type', 'application/json');
        response.end(JSON.stringify({ ok: true, result: true }));
      }
    });
  };
  const server = tls
    ? httpsServer(credentials, listener)
    : httpServer(listener);
  server.requestTimeout = 5000;
  server.setTimeout(3000, (socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    root: `${tls ? 'https' : 'http'}://127.0.0.1:${server.address().port}`,
    cert: credentials.cert,
    requests,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

export function tracedAgent(cert) {
  const paths = [];
  class TracedAgent extends Agent {
    addRequest(request, options) {
      paths.push(options.path);
      return super.addRequest(request, options);
    }
  }
  return { agent: new TracedAgent({ ca: cert, keepAlive: true }), paths };
}

export function agentBot(reference, telegram, options = {}) {
  const bot = new (reference ? OriginalTelegraf : Telegraf)('123:agent', {
    telegram,
    ...options,
  });
  bot.botInfo = webhookInfo;
  return bot;
}

export async function agentScenario(reference, mutate = false) {
  const server = await agentServer();
  const first = tracedAgent(server.cert);
  const second = tracedAgent(server.cert);
  const contexts = [];
  try {
    const bot = agentBot(reference, {
      apiRoot: `${server.root}/`,
      agent: first.agent,
    });
    bot.use(async (ctx) => {
      contexts.push(ctx.telegram);
      if (mutate && contexts.length === 1) {
        ctx.telegram.options.agent = second.agent;
      }
      await ctx.telegram.sendMessage(7, 'context');
    });
    await bot.handleUpdate({ update_id: 1 });
    await bot.handleUpdate({ update_id: 2 });
    await bot.telegram.sendMessage(7, 'global');
    return {
      first: first.paths,
      second: second.paths,
      bodies: server.requests.map(botRequestFields),
      globalAgent: bot.telegram.options.agent === first.agent,
      nextAgent: contexts[1].options.agent === first.agent,
      ownOptions: contexts[0].options !== bot.telegram.options,
    };
  } finally {
    first.agent.destroy();
    second.agent.destroy();
    await server.close();
  }
}
