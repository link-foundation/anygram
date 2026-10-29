import { UnsupportedError } from './errors.js';
import { gramRequest, objectRequest, nativeTlObjects } from './requests.js';
import { mtcuteRequest } from './mtcute.js';
import { RpcOperations } from './operations.js';
import { botRequester } from './bot-backend.js';

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
const canonicalOperations = new Set([
  'iterDialogs',
  'checkChatInvite',
  'getNotifySettings',
]);

function hasFormattedEntities(operation, args) {
  return (
    operation === 'sendMessage' &&
    args[2]?.entities?.some((entity) => entity.type)
  );
}

export function createAdapter(
  name,
  client,
  { Api, kind = name, onSession, ...botOptions } = {}
) {
  if (!client || typeof client !== 'object') {
    throw new TypeError('An initialized backend client is required');
  }
  const style = kind === 'teleproto' ? 'gramjs' : kind;
  const bot = ['bot', 'grammy', 'telegraf', 'node-telegram-bot-api'].includes(
    style
  );
  const methods = styles[style] ?? {};
  const raw = style === 'mtproto' ? 'call' : 'invoke';
  const adapter = {
    name,
    kind,
    client,
    protocol: bot ? 'bot' : style === 'tdl' ? 'tdlib' : 'mtproto',
    supports(operation) {
      if (operation === 'bot') {
        return bot;
      }
      if (operation === 'invoke') {
        return (
          !bot &&
          style !== 'tdl' &&
          typeof client[style === 'mtcute' ? 'call' : raw] === 'function'
        );
      }
      return (
        typeof client[methods[operation] ?? operation] === 'function' ||
        (adapter.supports('invoke') &&
          typeof operations[operation] === 'function')
      );
    },
    async invoke(request, options) {
      if (style === 'gramjs') {
        if (
          !Api &&
          (!request.original?.getBytes || nativeTlObjects.has(request.original))
        ) {
          throw new UnsupportedError(
            'raw invocation requires the backend Api namespace',
            name
          );
        }
        return client.invoke(gramRequest(Api, request));
      }
      if (style === 'mtcute') {
        return client.call(await mtcuteRequest(request), options);
      }
      if (style === 'tdl') {
        throw new UnsupportedError(
          'MTProto RPCs require an MTProto backend; TDLib has a separate schema',
          name
        );
      }
      const { _: tag, ...params } = objectRequest(request);
      void tag;
      return client.call(request.method, params, options);
    },
    bot: botRequester(name, client, style, botOptions),
    async execute(operation, args) {
      const method = methods[operation] ?? operation;
      if (
        adapter.supports('invoke') &&
        typeof operations[operation] === 'function' &&
        (style !== 'gramjs' ||
          canonicalOperations.has(operation) ||
          typeof client[method] !== 'function' ||
          hasFormattedEntities(operation, args))
      ) {
        return operations[operation](...args);
      }
      if (operation === 'sendMessage' && style === 'gramjs') {
        return client[method](args[0], { ...args[2], message: args[1] });
      }
      const result = await client[method](...args);
      if (operation === 'start' && onSession && client.session?.save) {
        await onSession(client.session.save());
      }
      return result;
    },
    extended: new Proxy(client, {
      get(target, key) {
        const value = Reflect.get(target, key, target);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    }),
  };
  const operations = new RpcOperations(adapter.invoke.bind(adapter));
  return adapter;
}
