import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { readFile } from 'node:fs/promises';
import { once } from 'node:events';
import {
  telegrafWebhookBot,
  plainWebhookCalls,
  webhookUpdate,
} from './telegraf-webhook.js';

export async function telegrafTlsOptions() {
  const root = new globalThis.URL('./', import.meta.url);
  return {
    key: await readFile(new globalThis.URL('localhost-key.pem', root)),
    cert: await readFile(new globalThis.URL('localhost-cert.pem', root)),
  };
}

export function telegrafServerRequest(server, tls, options = {}) {
  const body = options.body ?? JSON.stringify(webhookUpdate);
  return new Promise((resolve, reject) => {
    const request = (tls ? httpsRequest : httpRequest)(
      {
        host: '127.0.0.1',
        port: server.address().port,
        path: '/hook',
        method: 'POST',
        agent: false,
        rejectUnauthorized: false,
        headers: { 'x-telegram-bot-api-secret-token': 'secret' },
        ...options,
      },
      (response) => {
        let result = '';
        response.setEncoding('utf8');
        response.on('data', (chunk) => {
          result += chunk;
          if (result.length > 65536) {
            request.destroy(new Error('Response limit'));
          }
        });
        response.once('error', reject);
        response.once('end', () =>
          resolve({
            status: response.statusCode,
            body: result ? JSON.parse(result) : '',
          })
        );
      }
    );
    request.setTimeout(3000, () =>
      request.destroy(new Error('Request deadline'))
    );
    request.once('error', reject);
    request.end(body);
  });
}

export async function closeTelegrafServer(bot) {
  const server = bot.webhookServer;
  if (!server?.listening) {
    return;
  }
  const closed = once(server, 'close');
  bot.stop('test cleanup');
  server.closeAllConnections?.();
  await closed;
}

export async function telegrafServerScenario(reference, tls, kind = 'reply') {
  const { bot, calls } = telegrafWebhookBot(reference);
  bot.use((ctx) => ctx.deleteMessage());
  const webhook = {
    domain: 'http://example.org:8443/base',
    hookPath: '/hook',
    port: 0,
    host: '127.0.0.1',
    secretToken: 'secret',
    ipAddress: '127.0.0.1',
    maxConnections: 4,
    ...(tls && { tlsOptions: await telegrafTlsOptions() }),
    ...(kind === 'fallback' && {
      cb: (_request, response) => {
        response.writeHead(202).end();
      },
    }),
  };
  let launched = 0;
  try {
    await bot.launch(
      {
        webhook,
        dropPendingUpdates: true,
        allowedUpdates: ['message'],
        maxPolls: 0,
      },
      () => {
        launched++;
      }
    );
    const server = bot.webhookServer;
    assertServer(server);
    if (!server.listening) {
      await once(server, 'listening');
    }
    const overrides =
      kind === 'reply'
        ? {}
        : kind === 'malformed'
          ? { body: '{' }
          : { path: '/elsewhere' };
    const response = await telegrafServerRequest(server, tls, overrides);
    return plainWebhookCalls({ calls, launched, response });
  } finally {
    await closeTelegrafServer(bot);
  }
}

function assertServer(server) {
  if (!server) {
    throw new Error('Webhook server was not started');
  }
}

export async function telegrafStartupStage(stage) {
  let timer;
  try {
    return await Promise.race([
      stage,
      new Promise((_, reject) => {
        timer = globalThis.setTimeout(
          () => reject(new Error('Telegraf startup stage was not reached')),
          1000
        );
      }),
    ]);
  } finally {
    globalThis.clearTimeout(timer);
  }
}
