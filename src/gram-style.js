import { RpcOperations, iterateHistory, normalize } from './operations.js';
import { camel, gramClassName } from './requests.js';

function convert(value) {
  if (value instanceof Uint8Array) {
    return Uint8Array.from(value);
  }
  if (Array.isArray(value)) {
    return value.map(convert);
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  return Object.fromEntries([
    ...Object.entries(value).map(([key, entry]) => [
      camel(key),
      convert(entry),
    ]),
    ...(value._ ? [['className', gramClassName(value._)]] : []),
  ]);
}

export function gramView(value) {
  return convert(normalize(value));
}

function dialogView(entry) {
  const entity = gramView(entry.entity);
  const dialog = gramView(entry.dialog);
  const message = gramView(entry.message);
  const type = entry.entity._;
  const id = type.startsWith('channel')
    ? BigInt(`-100${entity.id}`)
    : type.startsWith('chat')
      ? -BigInt(entity.id)
      : BigInt(entity.id);
  const title =
    entity.title ??
    [entity.firstName, entity.lastName].filter(Boolean).join(' ');
  return {
    dialog,
    entity,
    inputEntity: gramView(entry.inputPeer),
    message,
    id,
    name: title,
    title,
    pinned: Boolean(dialog.pinned),
    folderId: dialog.folderId,
    archived: dialog.folderId !== undefined,
    date: message?.date,
    unreadCount: dialog.unreadCount,
    unreadMentionsCount: dialog.unreadMentionsCount,
    isUser: type === 'user',
    isChannel: type === 'channel',
    isGroup:
      ['chat', 'chatForbidden'].includes(type) ||
      (type === 'channel' && Boolean(entity.megagroup)),
  };
}

/** Data views share canonical operations; vendor custom model methods stay extended. */
export function createGramStyle(client) {
  const operations = new RpcOperations((request, options) =>
    client.invoke(request.method, request.params, options)
  );
  const style = {
    invoke: client.invoke.bind(client),
    sendMessage: (peer, options) =>
      client.sendMessage(peer, options.message, options),
    async getMe(options) {
      return gramView(await operations.getMe(options));
    },
    async getEntity(peer, options) {
      return gramView(await operations.getEntity(peer, options));
    },
    async getInputEntity(peer, options) {
      return gramView(await operations.getInputEntity(peer, options));
    },
    async getMessages(peer, options) {
      return gramView(await operations.getMessages(peer, options));
    },
    async *iterMessages(peer, options) {
      for await (const message of iterateHistory(
        (page) => operations.getMessages(peer, page),
        options
      )) {
        yield gramView(message);
      }
    },
    async *iterDialogs(options) {
      for await (const entry of operations.iterDialogs(options)) {
        yield dialogView(entry);
      }
    },
    async getDialogs(options) {
      const dialogs = [];
      for await (const dialog of style.iterDialogs(options)) {
        dialogs.push(dialog);
      }
      return dialogs;
    },
  };
  return style;
}
