import { TelegramError, UnsupportedError } from './errors.js';
import { methodProxy, requestOf, nativeTlObjects } from './requests.js';
import { iterateHistory } from './operations.js';
import { botTextParams } from './formatting.js';
import { withConnection } from './lifecycle.js';
import { createGramStyle } from './gram-style.js';

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
    this.gramjs = createGramStyle(this);
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

  withConnection(task, options) {
    return withConnection(this, task, options);
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
    return this.route('invoke', async (adapter) => {
      if (nativeTlObjects.has(method)) {
        await method.resolve(
          {
            getInputEntity: (peer, settings) =>
              adapter.execute('getInputEntity', [peer, settings]),
          },
          options
        );
        options?.signal?.throwIfAborted();
        return adapter.invoke(requestOf(method), options);
      }
      return adapter.invoke(request, options);
    });
  }

  call(method, params, options) {
    return this.invoke(method, params, options);
  }

  callBotApi(method, params = {}, options) {
    return this.route('bot', (adapter) =>
      adapter.bot(method, botTextParams(params), options)
    );
  }

  execute(operation, ...args) {
    return this.route(operation, (adapter) => adapter.execute(operation, args));
  }

  sendMessage(peer, text, options = {}) {
    if (text && typeof text === 'object') {
      const { message, text: content, ...embedded } = text;
      return this.execute('sendMessage', peer, message ?? content, {
        ...embedded,
        ...options,
      });
    }
    return this.execute('sendMessage', peer, text, options);
  }

  iterMessages(peer, options) {
    return iterateHistory((page) => this.getMessages(peer, page), options);
  }

  async *iterDownload(media, options) {
    yield* await this.execute('iterDownload', media, options);
  }

  async *iterDialogs(options) {
    yield* await this.execute('iterDialogs', options);
  }

  async *iterDownloadEncryptedFile(file, options) {
    yield* await this.execute('iterDownloadEncryptedFile', file, options);
  }
}

for (const operation of [
  'connect',
  'disconnect',
  'start',
  'getMe',
  'getFileLink',
  'getMessages',
  'getDialogs',
  'getEntity',
  'getInputEntity',
  'getContacts',
  'getGreetingStickers',
  'downloadFile',
  'downloadProfilePhoto',
  'getParticipants',
  'sendFile',
  'sendAlbum',
  'uploadFile',
  'uploadEncryptedFile',
  'downloadEncryptedFile',
  'downloadMedia',
  'editMessage',
  'deleteMessages',
  'forwardMessages',
  'searchMessages',
  'resolvePeer',
  'joinChat',
  'checkChatInvite',
  'getNotifySettings',
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
