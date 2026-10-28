import { TelegramError, UnsupportedError } from './errors.js';
import { methodProxy, requestOf } from './requests.js';
import { iterateHistory } from './operations.js';

export class Anygram {
  constructor({ adapters = [], backend, debug } = {}) {
    this.adapters = [...adapters];
    this.debug = debug;
    const names = this.adapters.map((adapter) => adapter.name);
    if (names.length !== new Set(names).size) {
      throw new TypeError('Adapter names must be unique');
    }
    if (backend && !names.includes(backend)) {
      throw new TypeError(`Unknown backend: ${backend}`);
    }
    this.selected = backend;
    this.raw = methodProxy(this.invoke.bind(this));
    this.api = methodProxy(this.callBotApi.bind(this));
    this.telegram = this.api;
    this.gramjs = {
      invoke: this.invoke.bind(this),
      sendMessage: (peer, options) =>
        this.sendMessage(peer, options.message, options),
    };
    this.teleproto = this.gramjs;
    this.mtcute = {
      call: this.invoke.bind(this),
      sendText: this.sendMessage.bind(this),
    };
    this.mtproto = { call: this.invoke.bind(this) };
  }

  withBackend(backend) {
    return new Anygram({ adapters: this.adapters, backend, debug: this.debug });
  }

  backend(name = this.selected ?? this.adapters[0]?.name) {
    const adapter = this.adapters.find((candidate) => candidate.name === name);
    if (!adapter) {
      throw new TypeError(`Unknown backend: ${name}`);
    }
    return adapter.extended ?? adapter.client;
  }

  capabilities() {
    return this.adapters.map(({ name, protocol }) => ({ name, protocol }));
  }

  async route(operation, execute) {
    const adapter = this.adapters.find(
      (candidate) =>
        (!this.selected || candidate.name === this.selected) &&
        candidate.supports(operation)
    );
    if (!adapter) {
      throw new UnsupportedError(operation, this.selected);
    }
    // Intentionally log metadata only. Tokens, sessions, peers and message
    // contents never enter the default-off diagnostic callback.
    this.debug?.({ event: 'request', backend: adapter.name, operation });
    try {
      const result = await execute(adapter);
      this.debug?.({ event: 'response', backend: adapter.name, operation });
      return result;
    } catch (error) {
      this.debug?.({ event: 'error', backend: adapter.name, operation });
      throw TelegramError.from(error, adapter.name);
    }
  }

  invoke(method, params, options) {
    if (method && typeof method === 'object') {
      options ??= params;
    }
    const request = requestOf(method, params);
    return this.route('invoke', (adapter) => adapter.invoke(request, options));
  }

  call(method, params, options) {
    return this.invoke(method, params, options);
  }

  callBotApi(method, params = {}, options) {
    return this.route('bot', (adapter) => adapter.bot(method, params, options));
  }

  execute(operation, ...args) {
    return this.route(operation, (adapter) => adapter.execute(operation, args));
  }

  sendMessage(peer, text, options = {}) {
    if (text && typeof text === 'object') {
      return this.execute('sendMessage', peer, text.message ?? text.text, text);
    }
    return this.execute('sendMessage', peer, text, options);
  }

  iterMessages(peer, options) {
    return iterateHistory((page) => this.getMessages(peer, page), options);
  }

  async *iterDownload(media, options) {
    yield* await this.execute('iterDownload', media, options);
  }
}

for (const operation of [
  'connect',
  'disconnect',
  'start',
  'getMe',
  'getMessages',
  'getDialogs',
  'getEntity',
  'getParticipants',
  'sendFile',
  'sendAlbum',
  'uploadFile',
  'downloadMedia',
  'editMessage',
  'deleteMessages',
  'forwardMessages',
  'searchMessages',
  'resolvePeer',
  'joinChat',
  'leaveChat',
  'archiveChat',
  'muteChat',
  'addContact',
  'saveSession',
  'runUpdates',
  'stopUpdates',
  'watchChannel',
  'unwatchChannel',
]) {
  Anygram.prototype[operation] = function (...args) {
    return this.execute(operation, ...args);
  };
}
