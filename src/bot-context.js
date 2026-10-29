import { methodProxy } from './requests.js';
import { botTextParams } from './formatting.js';
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
      botApi({ callApi: (...args) => api.callApi(...args) }, 'telegraf');
    this.me = me;
    this.state = {};
  }
  get message() {
    return this.update.message;
  }
  get editedMessage() {
    return this.update.edited_message;
  }
  get channelPost() {
    return this.update.channel_post;
  }
  get callbackQuery() {
    return this.update.callback_query;
  }
  get inlineQuery() {
    return this.update.inline_query;
  }
  get msg() {
    return (
      this.message ??
      this.editedMessage ??
      this.channelPost ??
      this.callbackQuery?.message
    );
  }
  get chat() {
    return (
      this.msg?.chat ??
      this.update.my_chat_member?.chat ??
      this.update.chat_member?.chat
    );
  }
  get from() {
    return (
      this.callbackQuery?.from ??
      this.inlineQuery?.from ??
      this.msg?.from ??
      this.update.chat_member?.from ??
      this.update.my_chat_member?.from ??
      this.update.chat_join_request?.from
    );
  }
  get chatId() {
    return this.chat?.id ?? this.update.business_connection?.user_chat_id;
  }
  get botInfo() {
    return this.me;
  }
  reply(text, options, signal) {
    return this.api.sendMessage(this.chat.id, text, options, signal);
  }
  editMessageText(text, options, signal) {
    return callBotOperation(
      this.api,
      'editMessageText',
      {
        chat_id: this.chat?.id,
        message_id: this.msg?.message_id,
        inline_message_id: this.callbackQuery?.inline_message_id,
        text,
      },
      options,
      signal
    );
  }

  answerCallbackQuery(options, signal) {
    return this.api.answerCallbackQuery(
      this.callbackQuery.id,
      typeof options === 'string' ? { text: options } : options,
      signal
    );
  }
  deleteMessage(idOrOptions, options) {
    const explicitId = typeof idOrOptions === 'number';
    return this.api.deleteMessage(
      this.chat.id,
      explicitId ? idOrOptions : this.msg?.message_id,
      options ?? (explicitId ? undefined : idOrOptions)
    );
  }
}

/** Preserve Telegraf's username alias without changing grammY's user alias. */
export class TelegrafContext extends Context {
  constructor(update, api, me, telegram) {
    super(update, api, me, telegram);
    Object.defineProperty(this, 'me', { value: me?.username, writable: false });
    Object.defineProperty(this, 'botInfo', { value: me });
  }
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
  Context.prototype[`replyWith${media}`] = function (file, options, signal) {
    return this.api[`send${media}`](this.chat.id, file, options, signal);
  };
}

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
