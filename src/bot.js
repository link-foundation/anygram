import { BotApi } from './bot-api.js';
import {
  Context,
  botApi,
  compose,
  matchesFilter,
  matchText,
} from './bot-context.js';
import { TelegramError } from './errors.js';

/** Shared middleware runner usable with a native or adapted Bot API transport. */
export class Bot {
  constructor(token, options = {}) {
    this.api = botApi(options.api ?? new BotApi({ ...options, token }));
    this.telegram = this.api;
    this.botInfo = options.botInfo;
    this.middleware = [];
    this.offset = options.offset ?? 0;
    this.seen = new Set();
    this.queue = Promise.resolve();
    this.running = false;
    this.Context = options.Context ?? Context;
  }
  use(...middleware) {
    for (const entry of middleware) {
      this.middleware.push(
        typeof entry === 'function' ? entry : entry.middleware()
      );
    }
    return this;
  }
  on(filters, ...middleware) {
    const values = Array.isArray(filters) ? filters : [filters];
    const run = compose(middleware);
    return this.use((ctx, next) =>
      values.some((filter) => matchesFilter(ctx, filter))
        ? run(ctx, next)
        : next()
    );
  }
  command(commands, ...middleware) {
    const names = Array.isArray(commands) ? commands : [commands];
    const run = compose(middleware);
    return this.use((ctx, next) => {
      const message = ctx.message;
      const entity = message?.entities?.find(
        (entry) => entry.type === 'bot_command' && entry.offset === 0
      );
      if (!entity) {
        return next();
      }
      const [command, username] = message.text
        .slice(1, entity.length)
        .split('@');
      if (
        !names.includes(command) ||
        (username && username.toLowerCase() !== ctx.me?.username?.toLowerCase())
      ) {
        return next();
      }
      ctx.match = message.text.slice(entity.length).trimStart();
      return run(ctx, next);
    });
  }
  hears(pattern, ...middleware) {
    const run = compose(middleware);
    return this.use((ctx, next) => {
      const match = matchText(pattern, ctx.msg?.text);
      if (!match) {
        return next();
      }
      ctx.match = match;
      return run(ctx, next);
    });
  }
  action(pattern, ...middleware) {
    const run = compose(middleware);
    return this.use((ctx, next) => {
      const match = matchText(pattern, ctx.callbackQuery?.data);
      if (!match) {
        return next();
      }
      ctx.match = match;
      return run(ctx, next);
    });
  }
  catch(handler) {
    this.errorHandler = handler;
    return this;
  }
  async init() {
    this.botInfo ??= await this.api.getMe();
    return this.botInfo;
  }
  handleUpdate(update) {
    const task = this.queue.then(() => this.dispatch(update));
    this.queue = task.catch(() => {});
    return task;
  }
  async dispatch(update) {
    if (!Number.isSafeInteger(update?.update_id)) {
      throw new TypeError('Invalid Telegram update_id');
    }
    if (this.seen.has(update.update_id)) {
      return;
    }
    const ctx = new this.Context(update, this.api, this.botInfo);
    try {
      await compose(this.middleware)(ctx);
    } catch (error) {
      if (!this.errorHandler) {
        throw error;
      }
      await this.errorHandler(
        Object.assign(
          new Error('Bot update handler failed', { cause: error }),
          { error, ctx }
        )
      );
    }
    this.seen.add(update.update_id);
    if (this.seen.size > 10000) {
      this.seen.delete(this.seen.values().next().value);
    }
  }
  isRunning() {
    return this.running;
  }
  stop() {
    this.running = false;
    this.controller?.abort();
  }
  async start({
    maxPolls = Infinity,
    timeout = 30,
    allowed_updates,
    onStart,
  } = {}) {
    if (this.running) {
      throw new Error('Bot is already running');
    }
    this.running = true;
    this.controller = new globalThis.AbortController();
    try {
      await this.init();
      await onStart?.(this.botInfo);
      for (let count = 0; this.running && count < maxPolls; count++) {
        const updates = await this.api.callApi(
          'getUpdates',
          { offset: this.offset, timeout, allowed_updates },
          { signal: this.controller.signal, timeout: (timeout + 10) * 1000 }
        );
        for (const update of updates) {
          await this.handleUpdate(update);
          this.offset = Math.max(this.offset, update.update_id + 1);
          if (!this.running) {
            break;
          }
        }
      }
    } catch (error) {
      if (!this.controller.signal.aborted) {
        throw error;
      }
    } finally {
      this.running = false;
    }
  }
  launch(options) {
    return this.start(options);
  }
}

/** Event and positional-method facade used by node-telegram-bot-api 0.x. */
export class TelegramBot extends Bot {
  constructor(token, options = {}) {
    super(token, options);
    this.listeners = [];
    if (options.polling) {
      this.polling = Promise.resolve().then(() =>
        this.startPolling(
          typeof options.polling === 'object' ? options.polling : {}
        )
      );
      this.polling.catch((error) => this.emit('polling_error', error));
    }
  }
  on(event, callback) {
    this.listeners.push({ event, callback });
    return this;
  }
  once(event, callback) {
    this.listeners.push({ event, callback, once: true });
    return this;
  }
  onText(pattern, callback) {
    this.listeners.push({ event: 'message', pattern, callback });
    return this;
  }
  removeListener(event, callback) {
    this.listeners = this.listeners.filter(
      (entry) => entry.event !== event || entry.callback !== callback
    );
    return this;
  }
  removeAllListeners(event) {
    this.listeners = event
      ? this.listeners.filter((entry) => entry.event !== event)
      : [];
    return this;
  }
  async emit(event, value) {
    for (const entry of [...this.listeners]) {
      if (entry.event !== event) {
        continue;
      }
      const match = entry.pattern
        ? matchText(entry.pattern, value.text)
        : undefined;
      if (entry.pattern && !match) {
        continue;
      }
      if (entry.once) {
        this.listeners.splice(this.listeners.indexOf(entry), 1);
      }
      await entry.callback(value, match);
    }
  }
  async dispatch(update) {
    if (!Number.isSafeInteger(update?.update_id)) {
      throw new TypeError('Invalid Telegram update_id');
    }
    if (this.seen.has(update.update_id)) {
      return;
    }
    for (const [event, value] of Object.entries(update)) {
      if (event !== 'update_id') {
        await this.emit(event, value);
      }
    }
    await super.dispatch(update);
  }
  startPolling(options) {
    this.polling = this.start(options);
    return this.polling;
  }
  stopPolling() {
    this.stop();
    return this.polling ?? Promise.resolve();
  }
  processUpdate(update) {
    return this.handleUpdate(update);
  }
  sendMessage(chat, text, options) {
    return this.api.sendMessage(chat, text, options);
  }
  editMessageText(text, options) {
    return this.api.callApi('editMessageText', { ...options, text });
  }
  getChat(chat_id) {
    return this.api.callApi('getChat', { chat_id });
  }
  deleteMessage(chat, message) {
    return this.api.deleteMessage(chat, message);
  }
  answerCallbackQuery(id, options) {
    return this.api.answerCallbackQuery(id, options);
  }
}

function sameSecret(actual, expected) {
  const encode = new globalThis.TextEncoder();
  const a = encode.encode(actual ?? '');
  const b = encode.encode(expected);
  let mismatch = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) {
    mismatch |= (a[i] ?? 0) ^ b[i];
  }
  return mismatch === 0;
}

export function webhookCallback(
  bot,
  { secretToken, maxBytes = 1024 * 1024 } = {}
) {
  return async (request) => {
    if (request.method !== 'POST') {
      return new Response('POST required', { status: 405 });
    }
    if (
      secretToken &&
      !sameSecret(
        request.headers.get('x-telegram-bot-api-secret-token'),
        secretToken
      )
    ) {
      return new Response('Forbidden', { status: 403 });
    }
    let update;
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of request.body ?? []) {
        length += chunk.length;
        if (length > maxBytes) {
          throw new TelegramError('Update exceeds webhook size limit');
        }
        chunks.push(chunk);
      }
      const bytes = new Uint8Array(length);
      let offset = 0;
      for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.length;
      }
      update = JSON.parse(new globalThis.TextDecoder().decode(bytes));
      if (!Number.isSafeInteger(update?.update_id)) {
        throw new Error('Invalid update');
      }
    } catch {
      return new Response('Invalid update', { status: 400 });
    }
    try {
      await bot.handleUpdate(update);
      return new Response('OK');
    } catch {
      return new Response('Update processing failed', { status: 500 });
    }
  };
}
