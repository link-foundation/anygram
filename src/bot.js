import { BotApi } from './bot-api.js';
import {
  telegrafApi,
  cloneTelegramApi,
  telegrafPollingKey,
} from './telegraf-api.js';
import { launchTelegraf, stopTelegrafWebhook } from './telegraf-server.js';
import { Context, TelegrafContext, botApi, matchText } from './bot-context.js';
import { Composer } from './composer.js';
import { installTelegrafComposer } from './telegraf-composer.js';
import { BotError } from './bot-error.js';
import { TelegramError } from './errors.js';
import { pollingKey, acquirePolling, validatePolling } from './polling.js';
import { joinBytes } from './bytes.js';
import { taskContext } from './task-context.js';
import { callBotOperation } from './bot-operations.js';
import { webhookReplyScope } from './bot-webhook-reply.js';
import {
  frameworkWebhook,
  webhookDeadline,
  webhookOptions,
} from './bot-webhook.js';
import { sameWebhookSecret, webhookMode } from './bot-webhook-common.js';
import {
  telegrafWebhook,
  telegrafWebhookFilter,
  telegrafSecretPath,
  createTelegrafWebhook,
} from './telegraf-webhook.js';

/** Shared middleware runner usable with a native or adapted Bot API transport. */
export class Bot extends Composer {
  constructor(token, options = {}) {
    super();
    const transport = options.api ?? new BotApi({ ...options, token });
    this.api = botApi(transport);
    this.telegram = botApi(transport, 'telegraf');
    this.canUseWebhookReply = options.client?.canUseWebhookReply;
    this.botInfo = options.botInfo;
    this.offset = options.offset ?? 0;
    this.seen = new Set();
    this.processing = new Set();
    this.dispatchContext = taskContext();
    this.queue = Promise.resolve();
    this.running = false;
    this[webhookMode] = false;
    this.Context = options.Context ?? Context;
    this.pollingKey = pollingKey(token, options);
  }
  catch(handler) {
    this.errorHandler = handler;
    return this;
  }
  async init() {
    if (this.botInfo) {
      return this.botInfo;
    }
    this.initialization ??= Promise.resolve().then(() => this.api.getMe());
    try {
      this.botInfo = await this.initialization;
      return this.botInfo;
    } finally {
      this.initialization = undefined;
    }
  }
  handleUpdate(update, response) {
    const context = this.dispatchContext.current();
    const depth = context ? context.value + 1 : 0;
    if (depth > 64) {
      return Promise.reject(
        new RangeError('Nested bot update depth limit exceeded')
      );
    }
    const run = () =>
      this.dispatchContext.run(depth, () => this.dispatch(update, response));
    if (context) {
      return run();
    }
    const task = this.queue.then(run);
    this.queue = task.catch(() => {});
    return task;
  }
  async dispatch(update, response) {
    const scope = webhookReplyScope(
      this.api,
      cloneTelegramApi(this.telegram),
      response,
      this.canUseWebhookReply
    );
    try {
      if (!Number.isSafeInteger(update?.update_id)) {
        throw new TypeError('Invalid Telegram update_id');
      }
      if (
        this.seen.has(update.update_id) ||
        this.processing.has(update.update_id)
      ) {
        return;
      }
      this.processing.add(update.update_id);
      try {
        return await this.#dispatchUpdate(update, scope);
      } finally {
        this.processing.delete(update.update_id);
      }
    } finally {
      scope.close();
    }
  }
  createContext(update, scope) {
    return new this.Context(update, scope.api, this.botInfo, scope.telegram);
  }
  runMiddleware(ctx) {
    return this.middleware()(ctx, () => Promise.resolve());
  }
  async #dispatchUpdate(update, scope) {
    const ctx = this.createContext(update, scope);
    let result;
    try {
      await this.emitUpdate?.(update);
      await this.runMiddleware(ctx);
    } catch (error) {
      if (!this.errorHandler) {
        throw error;
      }
      result = await this.errorHandler(
        Object.assign(new BotError(error, ctx), { cause: error })
      );
    }
    this.seen.add(update.update_id);
    if (this.seen.size > 10000) {
      this.seen.delete(this.seen.values().next().value);
    }
    return result;
  }
  isRunning() {
    return this.running;
  }
  stop() {
    this.running = false;
    this.controller?.abort();
  }
  async poll(timeout, allowed_updates) {
    try {
      return await this.api.callApi(
        'getUpdates',
        { offset: this.offset, timeout, allowed_updates },
        { signal: this.controller.signal, timeout: (timeout + 10) * 1000 }
      );
    } catch (error) {
      if (this.controller.signal.aborted) {
        return [];
      }
      throw error;
    }
  }
  async start({
    maxPolls = Infinity,
    timeout = 30,
    allowed_updates,
    onStart,
  } = {}) {
    if (this[webhookMode]) {
      throw new Error('Bot already uses webhooks; long polling is unavailable');
    }
    if (this.running) {
      throw new Error('Bot is already running');
    }
    validatePolling(maxPolls, timeout);
    const release = acquirePolling(this.pollingKey);
    this.running = true;
    this.controller = new globalThis.AbortController();
    try {
      await this.init();
      await onStart?.(this.botInfo);
      for (let count = 0; this.running && count < maxPolls; count++) {
        const updates = await this.poll(timeout, allowed_updates);
        for (const update of updates) {
          await this.handleUpdate(update);
          this.offset = Math.max(this.offset, update.update_id + 1);
          if (!this.running) {
            break;
          }
        }
      }
    } finally {
      this.running = false;
      release();
    }
  }
  launch(options) {
    return this.start(options);
  }
}

/** Telegraf command registration and launch style over the shared bot runner. */
export class Telegraf extends Bot {
  constructor(token, options = {}) {
    const telegram = telegrafApi(token, options);
    super(token, {
      ...options,
      api: telegram,
      Context: options.Context ?? TelegrafContext,
    });
    this.telegram = telegram;
    this.token = token;
    this.webhookFilter = telegrafWebhookFilter;
    this.context = {};
    this.contextType = options.contextType;
    this.handlerTimeout = webhookOptions({
      timeoutMilliseconds: options.handlerTimeout ?? 90000,
    }).timeoutMilliseconds;
  }
  createContext(update, scope) {
    const ctx = this.contextType
      ? new this.contextType(update, scope.telegram, this.botInfo)
      : super.createContext(update, scope);
    return Object.assign(ctx, this.context);
  }
  runMiddleware(ctx) {
    return webhookDeadline(
      Promise.resolve().then(() => super.runMiddleware(ctx)),
      'throw',
      this.handlerTimeout,
      [],
      () => {},
      () =>
        Object.assign(
          new Error(
            `Promise timed out after ${this.handlerTimeout} milliseconds`
          ),
          { name: 'TimeoutError' }
        )
    );
  }
  async handleUpdate(update, response) {
    await this.init();
    return super.handleUpdate(update, response);
  }
  get webhookReply() {
    return this.telegram.webhookReply;
  }
  set webhookReply(value) {
    this.telegram.webhookReply = value;
  }
  webhookCallback(path, options) {
    return telegrafWebhook(this, path, options);
  }
  secretPathComponent() {
    return telegrafSecretPath(this.token);
  }
  createWebhook(options) {
    return createTelegrafWebhook(this, options);
  }
  catch(handler) {
    return super.catch(({ error, ctx }) => handler(error, ctx));
  }
  start(...middleware) {
    return this.command('start', ...middleware);
  }
  launch(options, onLaunch) {
    return launchTelegraf(this, options, onLaunch, (polling) => {
      this.pollingKey = telegrafPollingKey(this.telegram);
      return super.start(polling);
    });
  }
  isRunning() {
    return super.isRunning() || !!this.webhookServer?.listening;
  }
  stop() {
    super.stop();
    stopTelegrafWebhook(this);
  }
}

installTelegrafComposer(Telegraf);

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
  async emitUpdate(update) {
    for (const [event, value] of Object.entries(update)) {
      if (event !== 'update_id') {
        await this.emit(event, value);
      }
    }
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
  sendMessage(chat, text, options, signal) {
    return this.api.sendMessage(chat, text, options, signal);
  }
  editMessageText(text, options) {
    return callBotOperation(this.api, 'editMessageText', { text }, options);
  }
  getChat(chat_id, options) {
    return callBotOperation(this.api, 'getChat', { chat_id }, options);
  }
  deleteMessage(chat, message, options) {
    return this.api.deleteMessage(chat, message, options);
  }
  answerCallbackQuery(id, options, signal) {
    return this.api.answerCallbackQuery(id, options, signal);
  }
}

export function webhookCallback(
  bot,
  adapter,
  options,
  timeoutMilliseconds,
  token
) {
  const configuration =
    typeof options === 'object'
      ? options
      : { onTimeout: options, timeoutMilliseconds, secretToken: token };
  if (adapter === undefined) {
    const native = webhookCallback(bot, configuration);
    const express = frameworkWebhook(bot, 'express', configuration);
    return (...args) =>
      typeof args[0]?.headers?.get === 'function'
        ? native(...args)
        : express(...args);
  }
  if (typeof adapter === 'string' || typeof adapter === 'function') {
    return frameworkWebhook(bot, adapter, configuration);
  }
  const { secretToken, maxBytes = 1024 * 1024 } = adapter;
  return async (request) => {
    if (request.method !== 'POST') {
      return new Response('POST required', { status: 405 });
    }
    if (
      secretToken &&
      !sameWebhookSecret(
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
      const bytes = joinBytes(chunks, length);
      update = JSON.parse(new globalThis.TextDecoder().decode(bytes));
      if (!Number.isSafeInteger(update?.update_id)) {
        throw new Error('Invalid update');
      }
    } catch {
      return new Response('Invalid update', { status: 400 });
    }
    try {
      let payload;
      await bot.handleUpdate(update, {
        send: (body) => {
          payload = body;
        },
      });
      return payload === undefined
        ? new Response('OK')
        : new Response(payload, {
            headers: { 'content-type': 'application/json' },
          });
    } catch {
      return new Response('Update processing failed', { status: 500 });
    }
  };
}
