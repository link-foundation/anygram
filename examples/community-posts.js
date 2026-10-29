import { FileSessionStore } from '../src/storage.js';
import { createRequestScope } from '../src/http.js';
import { abortable } from '../src/cancellation.js';
import {
  CommunityState,
  usernamePattern,
  messageId,
} from './community-posts-state.js';
import { findCommunityPost } from './community-posts-search.js';

const day = 24 * 60 * 60 * 1000;
const actions = new Map([
  ['post_message', 'post'],
  ['lift_message', 'lift'],
]);
const userId = (value) => Number.isSafeInteger(value) && value > 0;
const chatId = (value) => Number.isSafeInteger(value) && value !== 0;
const sentAt = (date) =>
  date instanceof Date ? date.getTime() : Number(date) * 1000;
const rejected = (error) =>
  Number.isInteger(error.error_code) &&
  error.error_code >= 400 &&
  error.error_code < 500;
const menu = {
  inline_keyboard: [
    [{ text: 'Опубликовать сообщение', callback_data: 'post_message' }],
    [{ text: 'Поднять сообщение', callback_data: 'lift_message' }],
  ],
};

/** Complete community-posting flow using distinct bot and account transports. */
export class CommunityPosts {
  constructor({
    bot,
    account,
    channelUsername = 'community_posts',
    store = new FileSessionStore('.community-posts.json', {
      maxBytes: 4 * 1024 * 1024,
    }),
    now = Date.now,
    dailyLimit = day,
    promptLifetime = 10 * 60 * 1000,
    timeout = 30000,
    signal,
    onError,
    ...limits
  }) {
    if (
      typeof channelUsername !== 'string' ||
      !usernamePattern.test(channelUsername)
    ) {
      throw new TypeError('Invalid community channel username');
    }
    for (const value of [dailyLimit, promptLifetime, timeout]) {
      if (!Number.isSafeInteger(value) || value < 1) {
        throw new RangeError('Community deadlines must be positive integers');
      }
    }
    this.bot = bot;
    this.account = account;
    this.channel = `@${channelUsername}`;
    this.state = new CommunityState(store, limits);
    this.now = now;
    this.dailyLimit = dailyLimit;
    this.promptLifetime = promptLifetime;
    this.timeout = timeout;
    this.onError = onError;
    this.controller = new globalThis.AbortController();
    this.parent = signal;
    this.cancel = () => this.controller.abort(signal.reason);
    signal?.addEventListener('abort', this.cancel, { once: true });
    if (signal?.aborted) {
      this.cancel();
    }
    this.listeners = [];
    this.queue = Promise.resolve();
  }

  async init() {
    this.controller.signal.throwIfAborted();
    if (this.initialized) {
      throw new Error('Community application is already initialized');
    }
    this.initialized = true;
    await this.state.load();
    this.controller.signal.throwIfAborted();
    this.listen('callback_query', (query) => this.callback(query));
    this.listen('message', (message) => this.message(message));
    return this;
  }

  listen(event, handler) {
    const callback = (value) => {
      if (this.closed) {
        return;
      }
      const task = this.queue.then(() => {
        this.controller.signal.throwIfAborted();
        return handler(value);
      });
      const handled = this.onError ? task.catch(this.onError) : task;
      this.queue = handled.catch(() => {});
      return handled;
    };
    this.listeners.push({ event, callback });
    this.bot.on(event, callback);
  }

  async close() {
    this.closed = true;
    this.controller.abort();
    this.parent?.removeEventListener('abort', this.cancel);
    for (const { event, callback } of this.listeners) {
      this.bot.removeListener(event, callback);
    }
    this.listeners = [];
    await this.queue;
  }

  async scoped(work) {
    const scope = createRequestScope(
      {
        signal: this.controller.signal,
        timeout: this.timeout,
      },
      new Error('Community request timed out')
    );
    try {
      scope.signal.throwIfAborted();
      return await abortable(
        work({ signal: scope.signal, timeout: this.timeout }),
        scope.signal
      );
    } finally {
      scope.dispose();
    }
  }

  request(method, params) {
    return this.scoped((options) =>
      this.bot.api.callApi(method, params, options)
    );
  }

  tell(chat, text, options = {}) {
    return this.request('sendMessage', { ...options, chat_id: chat, text });
  }

  save(id, record) {
    return this.state.write(id, record, {
      retireBefore: this.now() - this.dailyLimit,
      promptBefore: this.now() - this.promptLifetime,
    });
  }

  async start(message) {
    try {
      const me = await this.request('getMe', {});
      await this.request('getChat', { chat_id: this.channel });
      const member = await this.request('getChatMember', {
        chat_id: this.channel,
        user_id: me.id,
      });
      if (
        !['creator', 'administrator'].includes(member.status) ||
        member.can_post_messages === false
      ) {
        throw new Error('Channel posting permission is missing');
      }
    } catch (error) {
      this.controller.signal.throwIfAborted();
      await this.tell(
        message.chat.id,
        `Канал не найден или бот не является администратором. Добавьте бота в @${this.channel.slice(1)}.`
      );
      throw error;
    }
    return this.tell(message.chat.id, 'Выберите действие:', {
      reply_markup: menu,
    });
  }

  async callback(query) {
    await this.request('answerCallbackQuery', { callback_query_id: query.id });
    const action = actions.get(query.data);
    if (
      !action ||
      !userId(query.from?.id) ||
      !chatId(query.message?.chat?.id)
    ) {
      return;
    }
    return this.prepare(query, action);
  }

  async prepare(query, action) {
    const id = String(query.from.id),
      chat = query.message.chat.id;
    if (!usernamePattern.test(query.from.username ?? '')) {
      return this.tell(chat, 'Укажите публичное имя пользователя Telegram.');
    }
    const record = this.state.users[id] ?? {};
    if (record.pending && record.pending.phase !== 'prompt') {
      return this.recover(id, chat);
    }
    const field = action === 'post' ? 'postAt' : 'liftAt';
    if (
      record[field] !== undefined &&
      this.now() - record[field] < this.dailyLimit
    ) {
      return this.tell(
        chat,
        action === 'post'
          ? 'Вы можете опубликовать только одно сообщение в день.'
          : 'Вы можете поднять своё сообщение только раз в день.'
      );
    }
    let original;
    if (action === 'lift') {
      original = await this.search(record.postUsername ?? query.from.username, {
        matches: (message) =>
          record.postId === undefined || message.id === record.postId,
      });
      if (!original) {
        return this.tell(chat, 'Ваше сообщение не найдено в канале.');
      }
    }
    await this.save(id, {
      ...record,
      pending: {
        action,
        phase: 'prompt',
        chatId: String(chat),
        username: query.from.username,
        createdAt: this.now(),
        ...(original ? { oldId: original.id } : {}),
      },
    });
    return this.tell(chat, 'Введите текст вашего сообщения:');
  }

  search(username, options) {
    return this.scoped((request) =>
      findCommunityPost(this.account, this.channel, username, {
        ...options,
        ...request,
      })
    );
  }

  async message(message) {
    if (!userId(message.from?.id) || !chatId(message.chat?.id)) {
      return;
    }
    const command = /^\/(start|cancel|status)(?:@\w+)?(?:\s|$)/.exec(
      message.text ?? ''
    )?.[1];
    if (command === 'start') {
      return this.start(message);
    }
    const id = String(message.from.id),
      record = this.state.users[id];
    const pending = record?.pending;
    if (!pending || pending.chatId !== String(message.chat.id)) {
      return;
    }
    if (command === 'status' || pending.phase !== 'prompt') {
      return this.recover(id, message.chat.id);
    }
    if (
      command === 'cancel' ||
      this.now() - pending.createdAt >= this.promptLifetime
    ) {
      const { pending: ignored, ...rest } = record;
      void ignored;
      await this.save(id, rest);
      return this.tell(message.chat.id, 'Ввод сообщения отменён.');
    }
    return this.publish(id, message);
  }

  async publish(id, message) {
    const record = this.state.users[id],
      pending = record.pending;
    if (typeof message.text !== 'string' || message.text.startsWith('/')) {
      return this.tell(
        message.chat.id,
        'Отправьте текст сообщения или /cancel.'
      );
    }
    const text = `${message.text}\n\n@${pending.username}`;
    if (!message.text.trim() || text.length > 4096) {
      return this.tell(
        message.chat.id,
        'Сообщение пустое или превышает 4096 символов.'
      );
    }
    const publishing = {
      ...pending,
      phase: 'publishing',
      text,
      createdAt: this.now(),
    };
    await this.save(id, { ...record, pending: publishing });
    const sent = await this.deliver(id, record, publishing);
    if (!messageId(sent?.message_id)) {
      throw new Error('Community publication returned an invalid message ID');
    }
    return this.complete(id, sent.message_id);
  }

  async deliver(id, record, publishing) {
    let dispatched = false;
    try {
      return await this.scoped((options) => {
        dispatched = true;
        return this.bot.api.callApi(
          'sendMessage',
          {
            chat_id: this.channel,
            text: publishing.text,
          },
          options
        );
      });
    } catch (error) {
      if (!dispatched || rejected(error)) {
        await this.save(id, record);
      }
      throw error;
    }
  }

  async complete(id, sentId) {
    const record = this.state.users[id],
      pending = record.pending;
    const { pending: ignored, ...rest } = record;
    void ignored;
    const next = {
      ...rest,
      postId: sentId,
      postUsername: pending.username,
      [pending.action === 'post' ? 'postAt' : 'liftAt']: this.now(),
    };
    if (pending.action === 'lift') {
      next.pending = { ...pending, phase: 'cleanup', newId: sentId };
    }
    await this.save(id, next);
    if (next.pending) {
      return this.cleanup(id);
    }
    return this.tell(pending.chatId, 'Ваше сообщение опубликовано!');
  }

  async cleanup(id) {
    const record = this.state.users[id],
      pending = record.pending;
    try {
      await this.request('deleteMessage', {
        chat_id: this.channel,
        message_id: pending.oldId,
      });
    } catch (error) {
      if (
        !/message to delete not found/i.test(error.description ?? error.message)
      ) {
        throw error;
      }
    }
    const { pending: ignored, ...rest } = record;
    void ignored;
    await this.save(id, rest);
    return this.tell(pending.chatId, 'Ваше сообщение поднято!');
  }

  async recover(id, chat) {
    const pending = this.state.users[id].pending;
    if (pending.chatId !== String(chat)) {
      return;
    }
    if (pending.phase === 'cleanup') {
      return this.cleanup(id);
    }
    if (pending.phase === 'prompt') {
      return this.tell(chat, 'Введите текст вашего сообщения или /cancel.');
    }
    const found = await this.search(pending.username, {
      matches: (message) =>
        message.text === pending.text &&
        message.id !== pending.oldId &&
        sentAt(message.date) >= pending.createdAt - 1000,
    });
    if (found) {
      return this.complete(id, found.id);
    }
    return this.tell(
      chat,
      'Результат отправки пока неизвестен. Повторите /status позже; сообщение автоматически не отправляется повторно.'
    );
  }
}

export async function createCommunityPosts(options) {
  const app = new CommunityPosts(options);
  try {
    return await app.init();
  } catch (error) {
    await app.close();
    throw error;
  }
}
