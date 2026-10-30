import { RpcOperations, iterateHistory, normalize } from './operations.js';
import { camel, gramClassName } from './requests.js';
import { bindAccountMessage } from './account-message.js';
import { accountMessageId } from './account-message-id.js';

function convert(value, context, origin) {
  if (value instanceof Uint8Array) {
    return Uint8Array.from(value);
  }
  if (Array.isArray(value)) {
    return value.map((entry) => convert(entry, context, origin));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }
  const result = Object.fromEntries([
    ...Object.entries(value).map(([key, entry]) => [
      camel(key),
      convert(entry, context, origin),
    ]),
    ...(value._ ? [['className', gramClassName(value._)]] : []),
  ]);
  if (context && ['message', 'messageService'].includes(value._)) {
    context.operations.rememberMessage(value, origin);
    return bindAccountMessage(result, context, origin && convert(origin));
  }
  return result;
}

export function gramView(value) {
  return convert(normalize(value));
}

function dialogView(entry, wrap) {
  const entity = wrap(entry.entity);
  const dialog = wrap(entry.dialog);
  const message = wrap(entry.message, entry.inputPeer);
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
    inputEntity: wrap(entry.inputPeer),
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

/** Data views and origin-bound messages share the selected canonical operations. */
export function createGramStyle(client, kind = 'gramjs') {
  const operations = new RpcOperations((request, options) =>
    client.invoke(request.method, request.params, options)
  );
  const entityViews = new WeakMap();
  const context = {
    client,
    kind,
    operations,
    wrap(value, origin) {
      const canonical = normalize(value);
      operations.remember(canonical);
      return convert(canonical, context, origin && normalize(origin));
    },
    viewEntity(value) {
      if (!entityViews.has(value)) {
        entityViews.set(value, context.wrap(value));
      }
      return entityViews.get(value);
    },
  };
  const wrap = context.wrap;
  function textSettings(options = {}) {
    const parseMode =
      options.parseMode === undefined ? client.parseMode : options.parseMode;
    return parseMode === undefined ? options : { ...options, parseMode };
  }
  async function sendMessage(peer, options) {
    const settings = textSettings(options);
    const formatted =
      settings.parseMode !== undefined ||
      options.formattingEntities !== undefined ||
      options.entities !== undefined;
    return wrap(
      await client.route('sendMessage', (adapter) =>
        formatted && adapter.supports('invoke')
          ? operations.sendMessage(peer, options.message, settings)
          : adapter.execute('sendMessage', [peer, options.message, settings])
      )
    );
  }
  const style = {
    get parseMode() {
      return client.parseMode;
    },
    set parseMode(mode) {
      client.setParseMode(mode);
    },
    setParseMode: (mode) => client.setParseMode(mode),
    invoke: async (...args) => wrap(await client.invoke(...args)),
    sendReaction: async (...args) =>
      wrap(await operations.sendReaction(...args)),
    getReactionUsers: async (...args) =>
      wrap(await operations.getReactionUsers(...args)),
    sendMessage,
    async sendFile(peer, options) {
      const settings = textSettings(options);
      return wrap(
        await client.route('sendFile', (adapter) =>
          adapter.supports('invoke')
            ? operations.sendFile(peer, settings)
            : adapter.execute('sendFile', [peer, settings])
        )
      );
    },
    async sendAlbum(peer, files, options) {
      const settings = textSettings(options);
      return wrap(
        await client.route('sendAlbum', (adapter) =>
          adapter.supports('invoke')
            ? operations.sendAlbum(peer, files, settings)
            : adapter.execute('sendAlbum', [peer, files, settings])
        )
      );
    },
    async getMe(options) {
      return wrap(await operations.getMe(options));
    },
    async getEntity(peer, options) {
      return wrap(await operations.getEntity(peer, options));
    },
    async getInputEntity(peer, options) {
      return wrap(await operations.getInputEntity(peer, options));
    },
    async getMessages(peer, options) {
      const input = await operations.resolvePeer(peer, options);
      return wrap(await operations.getMessages(input, options), input).map(
        (message) => (message._ === 'messageEmpty' ? undefined : message)
      );
    },
    async getRichMessage(peer, message, options) {
      options?.signal?.throwIfAborted();
      const id = accountMessageId(message);
      const input = await operations.resolvePeer(peer, options);
      return wrap(await operations.getRichMessage(input, id, options), input);
    },
    async *iterMessages(peer, options) {
      let input;
      const getPage = async (page) => {
        input ??= await operations.resolvePeer(peer, page);
        return operations.getMessages(input, page);
      };
      for await (const message of iterateHistory(getPage, options)) {
        if (message._ !== 'messageEmpty') {
          yield wrap(message, input);
        }
      }
    },
    async *iterDialogs(options) {
      for await (const entry of operations.iterDialogs(options)) {
        yield dialogView(entry, wrap);
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
  context.style = style;
  return style;
}
