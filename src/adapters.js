import { UnsupportedError } from './errors.js';
import { gramRequest, objectRequest } from './requests.js';

const styles = {
  gramjs: {
    sendMessage: 'sendMessage',
    getMe: 'getMe',
    getMessages: 'getMessages',
    getDialogs: 'getDialogs',
    getEntity: 'getEntity',
    sendFile: 'sendFile',
    downloadMedia: 'downloadMedia',
    editMessage: 'editMessage',
    deleteMessages: 'deleteMessages',
    forwardMessages: 'forwardMessages',
    getParticipants: 'getParticipants',
  },
  mtcute: {
    sendMessage: 'sendText',
    getMe: 'getMe',
    getMessages: 'getHistory',
    getDialogs: 'getDialogs',
    getEntity: 'resolvePeer',
    sendFile: 'sendMedia',
    downloadMedia: 'downloadToBuffer',
    editMessage: 'editMessage',
    deleteMessages: 'deleteMessages',
    forwardMessages: 'forwardMessages',
    getParticipants: 'getChatMembers',
  },
};

export function createAdapter(name, client, { Api, kind = name } = {}) {
  if (!client || typeof client !== 'object') {
    throw new TypeError('An initialized backend client is required');
  }
  const style = kind === 'teleproto' ? 'gramjs' : kind;
  const bot = ['bot', 'grammy', 'telegraf', 'node-telegram-bot-api'].includes(
    style
  );
  const api = client.api ?? client.telegram ?? client;
  const methods = styles[style] ?? {};
  const raw = style === 'mtproto' ? 'call' : 'invoke';
  return {
    name,
    kind,
    client,
    protocol: bot ? 'bot' : 'mtproto',
    supports(operation) {
      if (operation === 'bot') {
        return bot;
      }
      if (operation === 'invoke') {
        return (
          !bot &&
          typeof client[style === 'mtcute' ? 'call' : raw] === 'function'
        );
      }
      return typeof client[methods[operation] ?? operation] === 'function';
    },
    invoke(request, options) {
      if (style === 'gramjs') {
        if (!Api && !request.original?.getBytes) {
          throw new UnsupportedError(
            'raw invocation requires the backend Api namespace',
            name
          );
        }
        return client.invoke(gramRequest(Api, request));
      }
      if (style === 'mtcute') {
        return client.call(objectRequest(request), options);
      }
      if (style === 'tdl') {
        return client.invoke({ '@type': request.method, ...request.params });
      }
      const { _: tag, ...params } = objectRequest(request);
      void tag;
      return client.call(request.method, params, options);
    },
    bot(method, params, options) {
      if (typeof client.callApi === 'function') {
        return client.callApi(method, params, options);
      }
      if (style === 'grammy') {
        return api.raw[method](params, options?.signal);
      }
      if (typeof api.callApi === 'function') {
        return api.callApi(method, params, options);
      }
      if (typeof api.call === 'function') {
        return api.call(method, params, options);
      }
      if (typeof client._request === 'function') {
        return client._request(method, { form: params });
      }
      throw new UnsupportedError(method, name);
    },
    execute(operation, args) {
      const method = methods[operation] ?? operation;
      if (operation === 'sendMessage' && style === 'gramjs') {
        return client[method](args[0], { ...args[2], message: args[1] });
      }
      return client[method](...args);
    },
    extended: new Proxy(client, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }),
  };
}
