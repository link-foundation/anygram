import { parseTelegramLink } from '../src/index.js';
import { gramView } from '../src/gram-style.js';
import { normalize } from '../src/operations.js';

const joined = (result) => {
  const value = gramView(result);
  return value?._ === 'messages.chatInviteJoinResultOk' ? value.updates : value;
};
function peerKey(entity) {
  const value = normalize(entity);
  const type = value?._?.replace(/Forbidden$/, '');
  if (!['chat', 'channel', 'user'].includes(type)) {
    throw new TypeError('Expected a chat, channel or user entity');
  }
  if (typeof value.id === 'number' && !Number.isSafeInteger(value.id)) {
    throw new RangeError('Peer IDs require exact bigint or decimal strings');
  }
  return `${type}:${BigInt(value.id)}`;
}

/** Bridge follow's application helpers to a configured Anygram account. */
export class FollowClient {
  constructor(account, { Api, scope = {} } = {}) {
    this.account = account;
    this.Api = Api;
    this.scope = { ...scope };
    this.requestOptions = Object.fromEntries(
      Object.entries(scope).filter(
        ([key]) => !['start', 'cleanupAttempts', 'cleanupDelay'].includes(key)
      )
    );
    this.client = null;
  }

  active() {
    if (!this.client) {
      throw new Error('Client not connected. Use withConnection().');
    }
    return this.client;
  }

  async withConnection(task) {
    if (typeof task !== 'function') {
      throw new TypeError('Expected a connection callback');
    }
    if (this.client) {
      throw new Error('Follow connection is already owned');
    }
    return await this.account.withConnection(async (client) => {
      this.client = client;
      try {
        return await task(client.gramjs, this.Api);
      } finally {
        this.client = null;
      }
    }, this.scope);
  }

  getMe() {
    return this.active().gramjs.getMe(this.requestOptions);
  }

  getDialogs(options = {}) {
    const signal =
      this.requestOptions.signal && options.signal
        ? globalThis.AbortSignal.any([
            this.requestOptions.signal,
            options.signal,
          ])
        : (this.requestOptions.signal ?? options.signal);
    return this.active().gramjs.getDialogs({
      ...this.requestOptions,
      ...options,
      signal,
    });
  }

  getEntity(identifier) {
    return this.active().gramjs.getEntity(identifier, this.requestOptions);
  }

  async invoke(request) {
    return gramView(await this.active().invoke(request, this.requestOptions));
  }

  async sendMessage(entity, message) {
    return gramView(
      await this.active().sendMessage(entity, message, this.requestOptions)
    );
  }

  async joinChannel(channel) {
    return joined(await this.active().joinChat(channel, this.requestOptions));
  }

  async leaveChannel(channel) {
    return gramView(
      await this.active().leaveChat(channel, this.requestOptions)
    );
  }

  async importChatInvite(hash) {
    this.active();
    if (typeof hash !== 'string' || !/^[a-zA-Z0-9_-]{1,4096}$/.test(hash)) {
      throw new TypeError('Invalid invite hash');
    }
    return joined(
      await this.client.invoke(
        'messages.importChatInvite',
        { hash },
        this.requestOptions
      )
    );
  }

  async resolveUsername(username) {
    this.active();
    const link = parseTelegramLink(username);
    if (link.type !== 'public') {
      throw new TypeError('Expected a public username');
    }
    return gramView(
      await this.client.invoke(
        'contacts.resolveUsername',
        { username: link.username },
        this.requestOptions
      )
    );
  }

  updateNotificationSettings(peer, mute) {
    if (typeof mute !== 'boolean') {
      throw new TypeError('Expected a mute boolean');
    }
    return this.active().muteChat(peer, {
      ...this.requestOptions,
      until: mute ? 2147483647 : 0,
      showPreviews: !mute,
      silent: mute,
    });
  }

  async editFolder(peer, folderId) {
    if (![0, 1].includes(folderId)) {
      throw new RangeError('Expected main (0) or archive (1) folder');
    }
    return await this.active().archiveChat(peer, {
      ...this.requestOptions,
      archive: folderId === 1,
    });
  }

  async getNotifySettings(peer) {
    return gramView(
      await this.active().getNotifySettings(peer, this.requestOptions)
    );
  }

  async getDialogByEntity(entity, cachedDialogs) {
    this.active();
    const key = peerKey(entity);
    const dialogs = cachedDialogs ?? (await this.getDialogs());
    return (
      dialogs.find(
        (dialog) => dialog.entity && peerKey(dialog.entity) === key
      ) ?? null
    );
  }

  async getMessages(entity, limit = 20) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
      throw new RangeError('Expected a message limit from 1 to 100');
    }
    return await this.active().gramjs.getMessages(entity, {
      ...this.requestOptions,
      limit,
    });
  }

  parseInviteLink(input) {
    let link;
    try {
      link = parseTelegramLink(input);
    } catch {
      return null;
    }
    if (link.type === 'invite') {
      return { type: 'private', hash: link.hash };
    }
    if (link.type === 'privateMessage') {
      return { type: 'private_channel', channelId: String(link.channelId) };
    }
    return link.type === 'public'
      ? { type: 'public', username: link.username }
      : null;
  }
}
