import { pollingKey } from './polling.js';
import { BotApi } from './bot-api.js';
import { botApi } from './bot-context.js';
import { Agent } from 'node:https';
import { agentFetch } from './agent-fetch.js';
import { webhookReplyScope } from './bot-webhook-reply.js';

const clone = Symbol('clone Telegraf Telegram API');
const polling = Symbol('Telegraf polling ownership');
const implementations = new WeakMap();
const defaults = {
  apiRoot: 'https://api.telegram.org',
  apiMode: 'bot',
  testEnv: false,
  webhookReply: true,
  agent: new Agent({ keepAlive: true, keepAliveMsecs: 10000 }),
  attachmentAgent: undefined,
};

export function telegramMetadata(api, token, options, response) {
  const view = new Proxy(Object.create(Telegram.prototype), {
    get: (target, key, receiver) =>
      key in target ? Reflect.get(target, key, receiver) : api[key],
  });
  implementations.set(view, {
    api,
    methods: botApi(
      {
        callApi: (...args) => view.callApi(...args),
        getFileLink: async (file, options) => {
          options?.signal?.throwIfAborted();
          if (typeof file === 'string' || file.file_path === undefined) {
            file = await view.getFile(
              typeof file === 'string' ? file : file.file_id,
              options
            );
          }
          return api.getFileLink(file, options);
        },
      },
      'telegraf'
    ),
  });
  Object.defineProperties(view, {
    token: { value: token },
    options: { value: options },
    response: { value: response },
    webhookReply: {
      configurable: true,
      get: () => options.webhookReply,
      set: (value) => {
        options.webhookReply = value;
      },
    },
  });
  return view;
}

export function inheritTelegramMetadata(api, base, response) {
  if (Object.hasOwn(base, 'options')) {
    const view = telegramMetadata(api, base.token, base.options, response);
    Object.setPrototypeOf(view, Object.getPrototypeOf(base));
    return view;
  }
  return api;
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
  if (options.apiRoot.startsWith('http://')) {
    options.agent = undefined;
  }
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
      fetch: settings.fetch ?? agentFetch(options.agent),
      attachmentFetch:
        settings.attachmentFetch ??
        settings.fetch ??
        agentFetch(options.attachmentAgent),
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
  Object.setPrototypeOf(api, Telegram.prototype);
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

/** Public standalone Telegraf view, sharing the bot runner's transport and scope. */
export class Telegram {
  constructor(token, options = {}, response) {
    const api = telegrafApi(token, { ...options, telegram: options });
    const telegram = response
      ? webhookReplyScope(api, api, response).telegram
      : api;
    Object.setPrototypeOf(telegram, new.target.prototype);
    return telegram;
  }
}

// Derive shared prototype methods from the same facade used by every instance.
// This also lets subclass overrides call super without capturing another view.
for (const [name, method] of Object.entries(
  botApi({ callApi: () => undefined }, 'telegraf')
)) {
  if (typeof method === 'function') {
    Object.defineProperty(Telegram.prototype, name, {
      configurable: true,
      writable: true,
      value(...args) {
        const implementation = implementations.get(this);
        const methods =
          name === 'callApi' ? implementation.api : implementation.methods;
        return methods[name](...args);
      },
    });
  }
}
