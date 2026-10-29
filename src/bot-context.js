import { methodProxy } from './requests.js';
import { botTextParams } from './formatting.js';
import { positionalBotMethods } from './bot-positional.js';
import { telegrafBotMethods } from './telegraf-positional.js';
import { installContextData } from './bot-context-data.js';
import { installContextDelivery } from './bot-context-delivery.js';
import { installContextAdministration } from './bot-context-admin.js';
import { installContextServices } from './bot-context-services.js';
import { installContextMessageActions } from './bot-context-message-actions.js';
import { contextRequired } from './bot-context-scope.js';
import {
  botNoPayloadMethods,
  botRequestOptions,
  isBotSignal,
  callBotOperation,
} from './bot-operations.js';

export function botApi(transport, style = 'grammy') {
  const invoke =
    transport.callApi?.bind(transport) ?? transport.callBotApi.bind(transport);
  const call = (method, params, options) => {
    if (botNoPayloadMethods.has(method) && isBotSignal(params)) {
      options = params;
      params = {};
    }
    return invoke(
      method,
      botTextParams(params ?? {}),
      botRequestOptions(options)
    );
  };
  const raw = methodProxy(call);
  const operation = (method, params, options, signal) =>
    callBotOperation({ callApi: invoke }, method, params, options, signal);
  const positional = {
    raw,
    callApi: call,
    getFileLink: (...args) => transport.getFileLink(...args),
    sendMessage: (chat_id, text, options, signal) =>
      operation('sendMessage', { chat_id, text }, options, signal),
    deleteMessage: (chat_id, message_id, options) =>
      operation('deleteMessage', { chat_id, message_id }, options),
    answerCallbackQuery: (callback_query_id, options, signal) =>
      operation('answerCallbackQuery', { callback_query_id }, options, signal),
  };
  const edit = (params, options, signal) =>
    operation('editMessageText', params, options, signal);
  positional.editMessageText =
    style === 'telegraf'
      ? (chat_id, message_id, inline_message_id, text, options) =>
          edit({ chat_id, message_id, inline_message_id, text }, options)
      : (chat_id, message_id, text, options, signal) =>
          edit({ chat_id, message_id, text }, options, signal);
  positional.editMessageTextInline = (
    inline_message_id,
    text,
    options,
    signal
  ) => edit({ inline_message_id, text }, options, signal);
  for (const method of botNoPayloadMethods) {
    positional[method] = (options) => operation(method, {}, options);
  }
  for (const media of [
    'Photo',
    'Animation',
    'Video',
    'Audio',
    'Voice',
    'Document',
    'Sticker',
  ]) {
    positional[`send${media}`] = (chat_id, file, options, signal) =>
      operation(
        `send${media}`,
        { chat_id, [media.toLowerCase()]: file },
        options,
        signal
      );
  }
  if (style === 'grammy') {
    Object.assign(positional, positionalBotMethods({ callApi: invoke }));
  } else if (style === 'telegraf') {
    Object.assign(
      positional,
      telegrafBotMethods({
        callApi: invoke,
        getFileLink: (...args) => transport.getFileLink(...args),
      })
    );
  }
  return new Proxy(positional, {
    get: (target, key) => (key in target ? target[key] : raw[key]),
  });
}

export class Context {
  constructor(update, api, me, telegram) {
    this.update = update;
    this.api = api;
    this.telegram =
      telegram ??
      botApi(
        {
          callApi: (...args) => api.callApi(...args),
          getFileLink: (...args) => api.getFileLink(...args),
        },
        'telegraf'
      );
    this.me = me;
    this.state = {};
  }
  get botInfo() {
    return this.me;
  }
}

/** Preserve Telegraf's username alias without changing grammY's user alias. */
export class TelegrafContext extends Context {
  constructor(update, api, me, telegram) {
    super(update, api, me, telegram);
    Object.defineProperty(this, 'me', { value: me?.username, writable: false });
    Object.defineProperty(this, 'botInfo', { value: me });
  }
  get updateType() {
    for (const field in this.update) {
      if (typeof this.update[field] === 'object') {
        return field;
      }
    }
    throw new Error(
      `Cannot determine \`updateType\` of ${JSON.stringify(this.update)}`
    );
  }
  assert(value, method) {
    contextRequired(value, method, this);
  }
}

installContextData(Context);
installContextData(TelegrafContext, 'telegraf');
installContextDelivery(Context);
installContextDelivery(TelegrafContext, 'telegraf');
installContextAdministration(Context);
installContextAdministration(TelegrafContext, 'telegraf');
installContextServices(Context);
installContextServices(TelegrafContext, 'telegraf');
installContextMessageActions(Context);
installContextMessageActions(TelegrafContext, 'telegraf');

export function compose(middleware) {
  return (ctx, last = () => Promise.resolve()) => {
    let current = -1;
    const dispatch = async (index) => {
      if (index <= current) {
        throw new Error('next() called more than once');
      }
      current = index;
      const handler = middleware[index] ?? last;
      const run =
        typeof handler === 'function' ? handler : handler.middleware();
      return await run(ctx, () => dispatch(index + 1));
    };
    return dispatch(0);
  };
}

export function matchesFilter(ctx, filter) {
  const [event, field] = filter.split(':');
  const value = ctx.update[event];
  return value !== undefined && (!field || value[field] !== undefined);
}

export function matchText(pattern, text) {
  if (typeof text !== 'string') {
    return null;
  }
  if (typeof pattern === 'string') {
    return text === pattern ? [text] : null;
  }
  pattern.lastIndex = 0;
  return pattern.exec(text);
}
