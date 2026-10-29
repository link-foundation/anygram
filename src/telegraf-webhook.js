import { createHash } from 'node:crypto';
import process from 'node:process';
import {
  boundedWebhookUpdate,
  nodeWebhookInput,
  sameWebhookSecret,
  webhookHeader,
  webhookMode,
} from './bot-webhook-common.js';
import { webhookDeadline, webhookOptions } from './bot-webhook.js';

export function telegrafWebhookFilter(request) {
  return (
    request.method === 'POST' &&
    request.url === this.path &&
    (!this.secretToken ||
      sameWebhookSecret(request.headers[webhookHeader], this.secretToken))
  );
}

export function telegrafSecretPath(token) {
  return createHash('sha3-256')
    .update(token)
    .update(process.version)
    .digest('hex');
}

export function telegrafWebhookDomain(bot, { domain, path }) {
  const host = /^https?:\/\//.test(domain)
    ? new globalThis.URL(domain).host
    : domain;
  path ??= `/telegraf/${bot.secretPathComponent()}`;
  return { path, url: `https://${host}${path}` };
}

function preparsedUpdate(body, maxBytes) {
  if (body instanceof Uint8Array) {
    if (body.byteLength > maxBytes) {
      throw new RangeError('Webhook body exceeds byte limit');
    }
    body = new globalThis.TextDecoder().decode(body);
  }
  if (typeof body === 'string') {
    if (new globalThis.TextEncoder().encode(body).length > maxBytes) {
      throw new RangeError('Webhook body exceeds byte limit');
    }
    body = JSON.parse(body);
  }
  return boundedWebhookUpdate(body, maxBytes);
}

export function telegrafWebhook(bot, path = '/', options = {}) {
  const { secretToken, maxBytes, timeoutMilliseconds } = webhookOptions({
    ...options,
    timeoutMilliseconds: options.timeoutMilliseconds ?? 90000,
  });
  if (bot.running) {
    throw new Error('Bot is already running via long polling');
  }
  bot[webhookMode] = true;
  const filter = bot.webhookFilter.bind({ hookPath: path, path, secretToken });
  return async (
    request,
    response,
    next = () => {
      response.statusCode = 403;
      response.end();
    }
  ) => {
    if (!filter(request)) {
      return next();
    }
    const input = nodeWebhookInput(request, maxBytes);
    let active = true;
    const task = Promise.resolve().then(async () => {
      let update;
      try {
        update =
          request.body === undefined || request.body === null
            ? await input.read()
            : preparsedUpdate(request.body, maxBytes);
      } catch (error) {
        if (active) {
          response.writeHead(error instanceof RangeError ? 413 : 415).end();
        }
        return;
      }
      await bot.init();
      if (active) {
        await bot.handleUpdate(update, response);
      }
    });
    try {
      await webhookDeadline(task, 'throw', timeoutMilliseconds, [], () => {
        active = false;
      });
    } finally {
      active = false;
      input.close();
      if (response.writableEnded === false) {
        response.end();
      }
    }
  };
}

export async function createTelegrafWebhook(bot, { domain, path, ...extra }) {
  const target = telegrafWebhookDomain(bot, { domain, path });
  await bot.telegram.setWebhook(target.url, extra);
  return bot.webhookCallback(target.path, { secretToken: extra.secret_token });
}
