import { pollingKey } from './polling.js';
import { BotApi } from './bot-api.js';
import { botApi } from './bot-context.js';

const clone = Symbol('clone Telegraf Telegram API');
const polling = Symbol('Telegraf polling ownership');
const defaults = {
  apiRoot: 'https://api.telegram.org',
  apiMode: 'bot',
  testEnv: false,
  webhookReply: true,
};

export function telegramMetadata(api, token, options) {
  Object.defineProperties(api, {
    token: { value: token },
    options: { value: options },
    webhookReply: {
      configurable: true,
      get: () => options.webhookReply,
      set: (value) => {
        options.webhookReply = value;
      },
    },
  });
  return api;
}

export function inheritTelegramMetadata(api, base) {
  return Object.hasOwn(base, 'options')
    ? telegramMetadata(api, base.token, base.options)
    : api;
}

export function cloneTelegramApi(api) {
  return Object.hasOwn(api, clone) ? api[clone]() : api;
}

/** Each view owns mutable SDK settings; selected transports stay authoritative. */
export function telegrafApi(token, configuration, previous) {
  const settings = { ...configuration };
  const ownedRoot =
    settings.baseUrl !== undefined && settings.telegram?.apiRoot === undefined
      ? `${settings.baseUrl.replace(/\/$/, '')}/`
      : undefined;
  const options = {
    ...defaults,
    ...(settings.baseUrl !== undefined && {
      apiRoot: `${settings.baseUrl.replace(/\/$/, '')}/`,
    }),
    ...Object.fromEntries(
      Object.entries(previous ?? settings.telegram ?? {}).filter(
        ([, value]) => value !== undefined
      )
    ),
  };
  const root = () =>
    ownedRoot !== undefined && options.apiRoot === ownedRoot
      ? settings.baseUrl
      : new globalThis.URL('.', options.apiRoot).href;
  const native = () => {
    const baseUrl = root();
    return new BotApi({
      ...settings,
      token,
      baseUrl,
      apiMode: options.apiMode,
      testEnv: options.testEnv,
      fileOptions: {
        apiRoot: baseUrl,
        apiMode: options.apiMode,
        testEnv: options.testEnv,
        ...settings.fileOptions,
      },
    });
  };
  // Preserve constructor-time validation before any middleware is registered.
  if (!settings.api) {
    native();
  }
  const selected = settings.api ? botApi(settings.api) : undefined;
  const transport = {
    callApi: async (...args) => await (selected ?? native()).callApi(...args),
    getFileLink: async (...args) =>
      await (selected ?? native()).getFileLink(...args),
  };
  const api = telegramMetadata(botApi(transport, 'telegraf'), token, options);
  Object.defineProperties(api, {
    [clone]: { value: () => telegrafApi(token, settings, options) },
    [polling]: {
      value: () =>
        pollingKey(
          token,
          selected
            ? {}
            : {
                baseUrl: root(),
                apiMode: options.apiMode,
                testEnv: options.testEnv,
              }
        ),
    },
  });
  return api;
}

export function telegrafPollingKey(api) {
  return api[polling]();
}
