import { methodProxy } from './requests.js';

export function botApi(transport) {
  const call =
    transport.callApi?.bind(transport) ?? transport.callBotApi.bind(transport);
  const raw = methodProxy(call);
  const positional = {
    raw,
    callApi: call,
    sendMessage: (chat_id, text, options = {}) =>
      call('sendMessage', { ...options, chat_id, text }),
    editMessageText: (
      chat_id,
      message_id,
      inline_message_id,
      text,
      options = {}
    ) =>
      call('editMessageText', {
        ...options,
        chat_id,
        message_id,
        inline_message_id,
        text,
      }),
    deleteMessage: (chat_id, message_id) =>
      call('deleteMessage', { chat_id, message_id }),
    answerCallbackQuery: (callback_query_id, options = {}) =>
      call('answerCallbackQuery', { ...options, callback_query_id }),
  };
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
  constructor(update, api, me) {
    this.update = update;
    this.api = api;
    this.telegram = api;
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
    return this.callbackQuery?.from ?? this.inlineQuery?.from ?? this.msg?.from;
  }
  reply(text, options) {
    return this.api.sendMessage(this.chat.id, text, options);
  }
  editMessageText(text, options) {
    return this.api.editMessageText(
      this.chat?.id,
      this.msg?.message_id,
      this.callbackQuery?.inline_message_id,
      text,
      options
    );
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
      return await handler(ctx, () => dispatch(index + 1));
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
