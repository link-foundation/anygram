import { TelegramError } from './errors.js';
import { objectRequest, requestOf } from './requests.js';
import { MediaOperations } from './media.js';
import { randomId } from './random.js';
// Normalize raw client objects without changing exact IDs or byte buffers.
export function normalize(value) {
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  if (!value || typeof value !== 'object' || value instanceof Uint8Array) {
    return value;
  }
  if (value.__isLong__ || typeof value.toJSNumber === 'function') {
    return BigInt(value.toString());
  }
  if (value._ || value.className) {
    return objectRequest(requestOf(value));
  }
  const { _: tag, ...fields } = objectRequest({
    method: 'value',
    params: value,
  });
  void tag;
  return fields;
}

export async function* iterateHistory(
  getPage,
  { limit = Infinity, pageSize = 100, offsetId = 0, ...options } = {}
) {
  validateHistoryOptions(limit, pageSize);
  let remaining = limit;
  let seen = new Set();
  while (remaining > 0) {
    options.signal?.throwIfAborted();
    const requested = Math.min(pageSize, remaining);
    const messages = await getPage({
      ...options,
      limit: requested,
      offsetId,
    });
    let advanced = false;
    for (const message of messages) {
      if (seen.has(message.id)) {
        continue;
      }
      seen.add(message.id);
      advanced = true;
      yield message;
      if (--remaining === 0) {
        return;
      }
    }
    if (!advanced || messages.length < requested) {
      return;
    }
    offsetId = messages.at(-1).id;
    // Only adjacent pages can overlap in an ordered history; bound retained IDs.
    if (seen.size > pageSize * 2) {
      seen = new Set(messages.map((message) => message.id));
    }
  }
}

function validateHistoryOptions(limit, pageSize) {
  if (
    !(limit >= 0) ||
    !Number.isInteger(pageSize) ||
    pageSize < 1 ||
    pageSize > 100
  ) {
    throw new RangeError('Invalid history pagination limits');
  }
}

/** Shared high-level operations over any MTProto raw invocation function. */
export class RpcOperations extends MediaOperations {
  constructor(invoke, { maxPeers = 10000 } = {}) {
    super();
    this.invoke = invoke;
    this.maxPeers = maxPeers;
    this.peers = new Map();
  }

  async rpc(method, params = {}, options) {
    const result = normalize(
      await this.invoke(requestOf(method, params), options)
    );
    this.remember(result);
    return result;
  }

  remember(result) {
    if (!result || typeof result !== 'object') {
      return;
    }
    const entities = Array.isArray(result)
      ? result
      : [...(result.users ?? []), ...(result.chats ?? [])];
    for (const entity of entities) {
      const type = entity._?.replace(/Forbidden$/, '');
      if (!['user', 'chat', 'channel'].includes(type)) {
        continue;
      }
      const key = `${type}:${entity.id}`;
      this.peers.set(key, entity);
      if (entity.username) {
        this.peers.set(`@${entity.username.toLowerCase()}`, entity);
      }
      while (this.peers.size > this.maxPeers) {
        this.peers.delete(this.peers.keys().next().value);
      }
    }
  }

  inputPeer(entity) {
    if (entity?._ === 'user' && entity.self) {
      return { _: 'inputPeerSelf' };
    }
    const type = entity?._?.replace(/Forbidden$/, '');
    if (type === 'chat') {
      return { _: 'inputPeerChat', chat_id: BigInt(entity.id) };
    }
    if (
      ['user', 'channel'].includes(type) &&
      entity.access_hash !== undefined
    ) {
      return {
        _: `inputPeer${type[0].toUpperCase()}${type.slice(1)}`,
        [`${type}_id`]: BigInt(entity.id),
        access_hash: BigInt(entity.access_hash),
      };
    }
    throw new TelegramError(
      'Peer access hash is unavailable; load dialogs or resolve its username first',
      { type: 'PEER_NOT_FOUND' }
    );
  }

  async resolvePeer(peer) {
    if (peer === 'me' || peer === 'self') {
      return { _: 'inputPeerSelf' };
    }
    if (peer && typeof peer === 'object') {
      peer = normalize(peer);
      if (peer._?.startsWith('inputPeer')) {
        return peer;
      }
      return this.inputPeer(peer);
    }
    const text = String(peer);
    if (/^(?:@|https:\/\/t.me\/)?[a-zA-Z][\w]{2,}$/.test(text)) {
      return await this.resolveUsername(text);
    }
    if (typeof peer === 'number' && !Number.isSafeInteger(peer)) {
      throw new RangeError('Peer IDs require exact bigint or decimal strings');
    }
    const id = BigInt(peer);
    if (id < 0n && !text.startsWith('-100')) {
      return { _: 'inputPeerChat', chat_id: -id };
    }
    const type = text.startsWith('-100') ? 'channel' : 'user';
    const actual = type === 'channel' ? BigInt(text.slice(4)) : id;
    const cached = this.peers.get(`${type}:${actual}`);
    if (cached) {
      return this.inputPeer(cached);
    }
    throw new TelegramError(
      'Unknown peer ID; load dialogs or provide an InputPeer with an access hash',
      { type: 'PEER_NOT_FOUND' }
    );
  }

  async resolveUsername(text) {
    const username = text.replace(/^(?:@|https:\/\/t.me\/)/, '').toLowerCase();
    const cached = this.peers.get(`@${username}`);
    if (cached) {
      return this.inputPeer(cached);
    }
    const result = await this.rpc('contacts.resolveUsername', { username });
    const tag = result.peer._.replace('peer', '').toLowerCase();
    return this.inputPeer(this.peers.get(`${tag}:${result.peer[`${tag}_id`]}`));
  }

  async getMe(options) {
    return (
      await this.rpc(
        'users.getUsers',
        { id: [{ _: 'inputUserSelf' }] },
        options
      )
    )[0];
  }

  async getEntity(peer) {
    const resolved = await this.resolvePeer(peer);
    if (resolved._ === 'inputPeerSelf') {
      return this.getMe();
    }
    const type = resolved._.replace('inputPeer', '').toLowerCase();
    return this.peers.get(`${type}:${resolved[`${type}_id`]}`) ?? resolved;
  }

  async sendMessage(peer, text, options = {}) {
    const params = objectRequest(requestOf('messages.sendMessage', options));
    if (params.reply_to && typeof params.reply_to !== 'object') {
      params.reply_to = {
        _: 'inputReplyToMessage',
        reply_to_msg_id: params.reply_to,
      };
    }
    return this.rpc(
      'messages.sendMessage',
      {
        ...params,
        peer: await this.resolvePeer(peer),
        message: text,
        random_id: params.random_id ?? randomId(),
      },
      options
    );
  }

  async getMessages(peer, options = {}) {
    const input = await this.resolvePeer(peer);
    const params = objectRequest(requestOf('messages.getHistory', options));
    if (options.ids) {
      const id = []
        .concat(options.ids)
        .map((id) => ({ _: 'inputMessageID', id }));
      const result =
        input._ === 'inputPeerChannel'
          ? await this.rpc(
              'channels.getMessages',
              { channel: this.channel(input), id },
              options
            )
          : await this.rpc('messages.getMessages', { id }, options);
      return result.messages;
    }
    const result = await this.rpc(
      'messages.getHistory',
      {
        offset_id: 0,
        offset_date: 0,
        add_offset: 0,
        limit: 100,
        max_id: 0,
        min_id: 0,
        hash: 0n,
        ...params,
        peer: input,
      },
      options
    );
    return result.messages ?? [];
  }

  getDialogs(options = {}) {
    return this.rpc(
      'messages.getDialogs',
      {
        offset_date: 0,
        offset_id: 0,
        offset_peer: { _: 'inputPeerEmpty' },
        limit: 100,
        hash: 0n,
        ...objectRequest(requestOf('messages.getDialogs', options)),
      },
      options
    );
  }

  async editMessage(peer, { id, text, message = text, ...options }) {
    return this.rpc(
      'messages.editMessage',
      { ...options, peer: await this.resolvePeer(peer), id, message },
      options
    );
  }

  channel(peer) {
    if (peer._ !== 'inputPeerChannel') {
      throw new TypeError('This operation requires a channel or supergroup');
    }
    return {
      _: 'inputChannel',
      channel_id: peer.channel_id,
      access_hash: peer.access_hash,
    };
  }

  async deleteMessages(peer, ids, options = {}) {
    const input = await this.resolvePeer(peer);
    return input._ === 'inputPeerChannel'
      ? this.rpc(
          'channels.deleteMessages',
          { channel: this.channel(input), id: [].concat(ids) },
          options
        )
      : this.rpc(
          'messages.deleteMessages',
          { id: [].concat(ids), revoke: options.revoke ?? true },
          options
        );
  }

  async forwardMessages(peer, { fromPeer, messages, ...options }) {
    const ids = [].concat(messages);
    return this.rpc(
      'messages.forwardMessages',
      {
        ...options,
        from_peer: await this.resolvePeer(fromPeer),
        to_peer: await this.resolvePeer(peer),
        id: ids,
        random_id: ids.map(() => randomId()),
      },
      options
    );
  }

  async searchMessages(peer, query, options = {}) {
    const result = await this.rpc(
      'messages.search',
      {
        offset_id: 0,
        add_offset: 0,
        limit: 100,
        min_date: 0,
        max_date: 0,
        max_id: 0,
        min_id: 0,
        hash: 0n,
        filter: { _: 'inputMessagesFilterEmpty' },
        ...options,
        peer: await this.resolvePeer(peer),
        q: query,
      },
      options
    );
    return result.messages ?? [];
  }

  async getParticipants(peer, options = {}) {
    const input = await this.resolvePeer(peer);
    if (input._ === 'inputPeerChat') {
      const result = await this.rpc(
        'messages.getFullChat',
        { chat_id: input.chat_id },
        options
      );
      return result.full_chat.participants?.participants ?? [];
    }
    return this.rpc(
      'channels.getParticipants',
      {
        channel: this.channel(input),
        filter: { _: 'channelParticipantsRecent' },
        offset: 0,
        limit: 200,
        hash: 0n,
        ...options,
      },
      options
    );
  }

  async joinChat(peer, options) {
    const invite = /(?:t.me\/(?:joinchat\/|\+)|^\+)([\w-]+)/.exec(String(peer));
    return invite
      ? this.rpc('messages.importChatInvite', { hash: invite[1] }, options)
      : this.rpc(
          'channels.joinChannel',
          { channel: this.channel(await this.resolvePeer(peer)) },
          options
        );
  }

  async leaveChat(peer, options) {
    const input = await this.resolvePeer(peer);
    return input._ === 'inputPeerChat'
      ? this.rpc(
          'messages.deleteChatUser',
          { chat_id: input.chat_id, user_id: { _: 'inputUserSelf' } },
          options
        )
      : this.rpc(
          'channels.leaveChannel',
          { channel: this.channel(input) },
          options
        );
  }

  async archiveChat(peer, { archive = true, ...options } = {}) {
    return this.rpc(
      'folders.editPeerFolders',
      {
        folder_peers: [
          {
            _: 'inputFolderPeer',
            peer: await this.resolvePeer(peer),
            folder_id: archive ? 1 : 0,
          },
        ],
      },
      options
    );
  }

  async muteChat(peer, { until = 2147483647, ...options } = {}) {
    return this.rpc(
      'account.updateNotifySettings',
      {
        peer: { _: 'inputNotifyPeer', peer: await this.resolvePeer(peer) },
        settings: { _: 'inputPeerNotifySettings', mute_until: until },
      },
      options
    );
  }

  async addContact(
    peer,
    { firstName = '', lastName = '', phone = '', ...options } = {}
  ) {
    const input = await this.resolvePeer(peer);
    const id =
      input._ === 'inputPeerSelf'
        ? { _: 'inputUserSelf' }
        : {
            _: 'inputUser',
            user_id: input.user_id,
            access_hash: input.access_hash,
          };
    return this.rpc(
      'contacts.addContact',
      { ...options, id, first_name: firstName, last_name: lastName, phone },
      options
    );
  }
}
