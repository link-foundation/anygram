import { createPrivateKey, X509Certificate } from 'node:crypto';
import { telegrafWebhookDomain } from './telegraf-webhook.js';
import { webhookMode } from './bot-webhook-common.js';
import { validatePolling } from './polling.js';

/** Own startup until both the listener and Telegram registration succeed. */
async function listenWebhook(bot, options, path) {
  const { tlsOptions, port = 8443, host, cb, secretToken } = options;
  if (tlsOptions) {
    validateTlsCredentials(tlsOptions);
  }
  const callback = bot.webhookCallback(path, { secretToken });
  const listener = (request, response) => {
    Promise.resolve()
      .then(() =>
        callback(
          request,
          response,
          typeof cb === 'function' ? () => cb(request, response) : undefined
        )
      )
      .catch(() => {
        if (!response.writableEnded) {
          if (!response.headersSent) {
            response.statusCode = 500;
          }
          response.end();
        }
      });
  };
  const { createServer } = await import(
    tlsOptions ? 'node:https' : 'node:http'
  );
  const server = tlsOptions
    ? createServer(tlsOptions, listener)
    : createServer(listener);
  bot.webhookServer = server;
  // Request-body and middleware deadlines are also enforced by the callback.
  server.requestTimeout = 90000;
  server.headersTimeout = 60000;
  await new Promise((resolve, reject) => {
    const failed = (error) => {
      server.removeListener('listening', ready);
      reject(error);
    };
    const ready = () => {
      server.removeListener('error', failed);
      resolve();
    };
    server.once('error', failed).once('listening', ready);
    server.listen(port, host);
  });
  return server;
}

async function closeWebhook(bot) {
  const server = bot.webhookServer;
  bot.webhookServer = undefined;
  if (server?.listening) {
    await new Promise((resolve) => {
      server.close(resolve);
      server.closeAllConnections?.();
    });
  }
}

export function stopTelegrafWebhook(bot) {
  bot.launchController?.abort();
  const server = bot.webhookServer;
  bot.webhookServer = undefined;
  server?.close();
  server?.closeIdleConnections?.();
}

export async function launchTelegraf(bot, configuration, onLaunch, polling) {
  const [config, ready] =
    typeof configuration === 'function'
      ? [{}, configuration]
      : [configuration ?? {}, onLaunch];
  validateLaunch(bot, config);
  bot.launching = true;
  const controller = new globalThis.AbortController();
  bot.launchController = controller;
  try {
    await bot.init();
    await ready?.();
    if (
      controller.signal.aborted ||
      (!config.webhook && config.maxPolls === 0)
    ) {
      return;
    }
    const drop_pending_updates = config.dropPendingUpdates;
    const allowed_updates = config.allowedUpdates ?? config.allowed_updates;
    if (!config.webhook) {
      await bot.telegram.deleteWebhook({ drop_pending_updates });
      if (!controller.signal.aborted) {
        await polling({ ...config, allowed_updates });
      }
      return;
    }
    await registerWebhook(bot, config, controller);
  } catch (error) {
    await closeWebhook(bot);
    throw error;
  } finally {
    bot.launching = false;
  }
}

async function registerWebhook(bot, config, controller) {
  const webhook = config.webhook;
  const drop_pending_updates = config.dropPendingUpdates;
  const allowed_updates = config.allowedUpdates ?? config.allowed_updates;
  const target = telegrafWebhookDomain(bot, {
    domain: webhook.domain,
    path: webhook.path ?? webhook.hookPath,
  });
  await listenWebhook(bot, webhook, target.path);
  if (controller.signal.aborted) {
    await closeWebhook(bot);
    return;
  }
  await bot.telegram.setWebhook(target.url, {
    drop_pending_updates,
    allowed_updates,
    ip_address: webhook.ipAddress,
    max_connections: webhook.maxConnections,
    secret_token: webhook.secretToken,
    certificate: webhook.certificate,
  });
  if (controller.signal.aborted) {
    await closeWebhook(bot);
  }
}

function validateLaunch(bot, config) {
  if (bot.isRunning() || bot.launching) {
    throw new Error('Bot is already running');
  }
  if (!config.webhook && bot[webhookMode]) {
    throw new Error('Bot already uses webhooks; long polling is unavailable');
  }
  if (!config.webhook) {
    validatePolling(config.maxPolls ?? Infinity, config.timeout ?? 30);
  }
}

/** Deno defers PEM parsing until a connection; fail before registering instead. */
function validateTlsCredentials({ key, cert, passphrase }) {
  const material = (value) =>
    typeof value === 'string' || value instanceof Uint8Array;
  for (const entry of key === undefined
    ? []
    : Array.isArray(key)
      ? key
      : [key]) {
    const pem = entry?.pem ?? entry;
    if (material(pem)) {
      createPrivateKey({
        key: pem,
        passphrase: entry?.passphrase ?? passphrase,
      });
    }
  }
  for (const entry of cert === undefined
    ? []
    : Array.isArray(cert)
      ? cert
      : [cert]) {
    if (material(entry)) {
      new X509Certificate(entry);
    }
  }
}
