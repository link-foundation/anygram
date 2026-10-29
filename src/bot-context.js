import { methodProxy } from './requests.js';
import { botTextParams } from './formatting.js';

export function botApi(transport, style = 'grammy') {
  const invoke =
    transport.callApi?.bind(transport) ?? transport.callBotApi.bind(transport);
  const call = (method, params, options) =>
    invoke(method, botTextParams(params ?? {}), options);
  const raw = methodProxy(call);
  const positional = {
    raw,
    callApi: call,
    sendMessage: (chat_id, text, options = {}) =>
      call('sendMessage', { ...options, chat_id, text }),
    deleteMessage: (chat_id, message_id) =>
      call('deleteMessage', { chat_id, message_id }),
    answerCallbackQuery: (callback_query_id, options = {}) =>
      call('answerCallbackQuery', { ...options, callback_query_id }),
  };
  const edit = (params, signal) =>
    call('editMessageText', params, signal ? { signal } : undefined);
  positional.editMessageText =
    style === 'telegraf'
      ? (chat_id, message_id, inline_message_id, text, options = {}) =>
          edit({ ...options, chat_id, message_id, inline_message_id, text })
      : (chat_id, message_id, text, options = {}, signal) =>
          edit({ ...options, chat_id, message_id, text }, signal);
  positional.editMessageTextInline = (
    inline_message_id,
    text,
    options = {},
    signal
  ) => edit({ ...options, inline_message_id, text }, signal);
  for (const media of [
    'Photo',
    'Animation',
    'Video',
    'Audio',
    'Voice',
    'Document',
    'Sticker',
  ]) {
    positional[`send${media}`] = (chat_id, file, options = {}) =>
      call(`send${media}`, {
        ...options,
        chat_id,
        [media.toLowerCase()]: file,
      });
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
  reply(text, options) {
    return this.api.sendMessage(this.chat.id, text, options);
  }
  editMessageText(text, options) {
    return this.api.callApi('editMessageText', {
      ...options,
      chat_id: this.chat?.id,
      message_id: this.msg?.message_id,
      inline_message_id: this.callbackQuery?.inline_message_id,
      text,
    });
  }

  answerCallbackQuery(options) {
    return this.api.answerCallbackQuery(
      this.callbackQuery.id,
      typeof options === 'string' ? { text: options } : options
    );
  }
  deleteMessage(id = this.msg?.message_id) {
    return this.api.deleteMessage(this.chat.id, id);
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
  Context.prototype[`replyWith${media}`] = function (file, options) {
    return this.api[`send${media}`](this.chat.id, file, options);
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
