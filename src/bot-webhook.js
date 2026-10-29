import { frameworkWebhookAdapters } from './bot-webhook-frameworks.js';
import { serverlessWebhookAdapters } from './bot-webhook-serverless.js';
import { fetchWebhookAdapters } from './bot-webhook-fetch.js';
import {
  sameWebhookSecret,
  webhookMode,
  boundedWebhookUpdate,
} from './bot-webhook-common.js';
import { validateByteLimit } from './http.js';

const adapters = {
  ...frameworkWebhookAdapters,
  ...serverlessWebhookAdapters,
  ...fetchWebhookAdapters,
};

async function webhookDeadline(task, strategy, milliseconds, args, expire) {
  if (milliseconds === Infinity) {
    return task;
  }
  let timer;
  const deadline = new Promise((resolve, reject) => {
    timer = globalThis.setTimeout(() => {
      expire();
      if (strategy === 'throw') {
        reject(new Error(`Request timed out after ${milliseconds} ms`));
      } else {
        Promise.resolve()
          .then(() =>
            typeof strategy === 'function' ? strategy(...args) : undefined
          )
          .then(resolve, reject);
      }
    }, milliseconds);
  });
  try {
    return await Promise.race([task, deadline]);
  } finally {
    globalThis.clearTimeout(timer);
  }
}

function webhookOptions(options) {
  const {
    onTimeout = 'throw',
    timeoutMilliseconds = 10000,
    maxBytes = 1024 * 1024,
    secretToken,
  } = options;
  validateByteLimit(maxBytes);
  if (
    timeoutMilliseconds !== Infinity &&
    (!Number.isFinite(timeoutMilliseconds) ||
      timeoutMilliseconds < 0 ||
      timeoutMilliseconds > 2147483647)
  ) {
    throw new RangeError('Invalid webhook timeout');
  }
  if (
    typeof onTimeout !== 'function' &&
    !['throw', 'return'].includes(onTimeout)
  ) {
    throw new TypeError('Invalid webhook timeout strategy');
  }
  return { onTimeout, timeoutMilliseconds, maxBytes, secretToken };
}

export function frameworkWebhook(bot, adapter, options = {}) {
  const { onTimeout, timeoutMilliseconds, maxBytes, secretToken } =
    webhookOptions(options);
  const factory =
    typeof adapter === 'function'
      ? (args) => adapter(...args)
      : Object.hasOwn(adapters, adapter)
        ? adapters[adapter]
        : undefined;
  if (!factory) {
    throw new TypeError(`Unknown webhook adapter: ${adapter}`);
  }
  if (bot.isRunning?.()) {
    throw new Error('Bot is already running via long polling');
  }
  if (webhookMode in bot) {
    bot[webhookMode] = true;
  } else {
    bot.start = () => {
      throw new Error('Bot already uses webhooks; long polling is unavailable');
    };
  }
  let initialization;
  const initialize = () =>
    (initialization ??= Promise.resolve()
      .then(() => bot.init?.())
      .catch((error) => {
        initialization = undefined;
        throw error;
      }));
  return async (...args) => {
    const handler = factory(args, { maxBytes });
    let active = true;
    let used = false;
    let denied = false;
    const envelope = {
      get writableEnded() {
        return !active || used;
      },
      async send(body) {
        if (!active) {
          throw new Error('Webhook response ownership ended');
        }
        used = true;
        await handler.respond(body);
      },
    };
    try {
      const task = Promise.resolve().then(async () => {
        await initialize();
        if (!active) {
          return;
        }
        if (
          secretToken !== undefined &&
          (handler.header === undefined ||
            !sameWebhookSecret(handler.header, secretToken))
        ) {
          denied = true;
          await handler.unauthorized();
        } else {
          const update = await handler.update;
          if (active) {
            await bot.handleUpdate(
              boundedWebhookUpdate(update, maxBytes),
              envelope
            );
          }
        }
      });
      await webhookDeadline(task, onTimeout, timeoutMilliseconds, args, () => {
        active = false;
      });
      active = false;
      if (!used && !denied) {
        await handler.end?.();
      }
      return await handler.handlerReturn;
    } finally {
      active = false;
      await handler.close?.();
    }
  };
}
