import { TelegramError } from './errors.js';
import { canonicalValue, objectRequest, requestOf } from './requests.js';
import { MediaOperations } from './media.js';
import { randomId } from './random.js';
import { mtprotoTextParams } from './formatting.js';
import { iterateDialogs } from './dialogs.js';
import { parseTelegramLink } from './chat-links.js';
import { notificationOptions, notificationPeer } from './notifications.js';
import { reactionOf, reactionList } from './account-reactions.js';
import { accountMessageId, samePeerId } from './account-message-id.js';
import {
  hasMinAccessHash,
  rememberPeer,
  messagePeers,
  resultMessages,
  peerFamily,
  inputEntity,
} from './peer-cache.js';
// Normalize raw client objects without changing exact IDs or byte buffers.
export function normalize(value) {
  return canonicalValue(value);
}

function messageOrigin(operations, message, origin) {
  if (
    !Number.isSafeInteger(message.id) ||
    message.id < 1 ||
    message.id > 0x7fffffff
  ) {
    return undefined;
  }
  const type = message.peer_id?._?.slice(4).toLowerCase();
  if (!type) {
    return undefined;
  }
  if (
    peerFamily(origin) === type &&
    origin[`${type}_id`] === message.peer_id[`${type}_id`]
  ) {
    return origin;
  }
  try {
    return operations.resolveObjectPeer(message.peer_id);
  } catch (error) {
    if (error?.type !== 'PEER_NOT_FOUND') {
      throw error;
    }
    return undefined;
  }
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
    !(limit === Infinity || Number.isSafeInteger(limit)) ||
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
    this.peerContexts = new Map();
  }

  async rpc(method, params = {}, options) {
    options?.signal?.throwIfAborted();
    const result = normalize(
      await this.invoke(requestOf(method, mtprotoTextParams(params)), options)
    );
    this.remember(result);
    return result;
  }

  remember(result) {
    if (result?._ === 'messages.chatInviteJoinResultOk') {
      result = result.updates;
    }
    if (!result || typeof result !== 'object') {
      return;
    }
    const entities = Array.isArray(result)
      ? result
      : ['chatInviteAlready', 'chatInvitePeek'].includes(result._)
        ? [result.chat]
        : [...(result.users ?? []), ...(result.chats ?? [])];
    for (const entity of entities) {
      rememberPeer(this.peers, entity, this.maxPeers);
    }
    for (const message of resultMessages(result)) {
      this.rememberMessage(message);
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
      entity.access_hash !== undefined &&
      !hasMinAccessHash(entity)
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

  resolveObjectPeer(peer) {
    peer = normalize(peer);
    if (peer._?.startsWith('inputPeer')) {
      return peer;
    }
    if (peer._ === 'inputUserSelf') {
      return { _: 'inputPeerSelf' };
    }
    if (
      [
        'inputUser',
        'inputChannel',
        'inputUserFromMessage',
        'inputChannelFromMessage',
      ].includes(peer._)
    ) {
      return { ...peer, _: peer._.replace('input', 'inputPeer') };
    }
    if (peer._?.startsWith('peer')) {
      const type = peer._.slice(4).toLowerCase();
      const id = peer[`${type}_id`];
      return this.contextualInputPeer(
        type === 'chat' ? { _: 'chat', id } : this.peers.get(`${type}:${id}`)
      );
    }
    return this.contextualInputPeer(peer);
  }

  contextualInputPeer(entity) {
    try {
      return this.inputPeer(entity);
    } catch (error) {
      const context =
        entity?.min && this.peerContexts.get(`${entity._}:${entity.id}`);
      if (error?.type !== 'PEER_NOT_FOUND' || !context) {
        throw error;
      }
      return context;
    }
  }

  rememberMessage(message, origin) {
    origin = messageOrigin(this, message, origin);
    if (!origin) {
      return;
    }
    for (const peer of messagePeers(message)) {
      const family = peer?._?.slice(4).toLowerCase();
      if (!['user', 'channel'].includes(family)) {
        continue;
      }
      this.peerContexts.set(`${family}:${peer[`${family}_id`]}`, {
        _: `inputPeer${family === 'user' ? 'User' : 'Channel'}FromMessage`,
        peer: origin,
        msg_id: message.id,
        [`${family}_id`]: peer[`${family}_id`],
      });
    }
    while (this.peerContexts.size > this.maxPeers) {
      this.peerContexts.delete(this.peerContexts.keys().next().value);
    }
  }

  async resolvePeer(peer, options) {
    options?.signal?.throwIfAborted();
    if (peer === 'me' || peer === 'self') {
      return { _: 'inputPeerSelf' };
    }
    if (peer && typeof peer === 'object') {
      return this.resolveObjectPeer(peer);
    }
    const text = String(peer);
    if (!/^-?\d+$/.test(text)) {
      return await this.resolveLink(parseTelegramLink(text), options);
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
      return this.contextualInputPeer(cached);
    }
    throw new TelegramError(
      'Unknown peer ID; load dialogs or provide an InputPeer with an access hash',
      { type: 'PEER_NOT_FOUND' }
    );
  }

  async resolveLink(link, options) {
    if (link.type === 'public') {
      return this.resolveUsername(link.username, options);
    }
    if (link.type === 'privateMessage') {
      return this.resolvePeer(
        { _: 'peerChannel', channel_id: link.channelId },
        options
      );
    }
    if (link.type === 'phone') {
      return this.resolvedPeer(
        await this.rpc('contacts.resolvePhone', { phone: link.phone }, options)
      );
    }
    throw new TypeError('Invite links must be imported with joinChat');
  }

  async resolveUsername(username, options) {
    username = username.toLowerCase();
    const cached = this.peers.get(`@${username}`);
    if (cached && !hasMinAccessHash(cached)) {
      return this.inputPeer(cached);
    }
    return this.resolvedPeer(
      await this.rpc('contacts.resolveUsername', { username }, options)
    );
  }

  resolvedPeer(result) {
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

  getInputEntity(peer, options) {
    return this.resolvePeer(peer, options);
  }

  async getEntity(peer, options) {
    const resolved = await this.resolvePeer(peer, options);
    if (resolved._ === 'inputPeerSelf') {
      return this.getMe(options);
    }
    const type = peerFamily(resolved);
    const id = resolved[`${type}_id`];
    const cached = this.peers.get(`${type}:${id}`);
    if (cached && !cached.min) {
      return cached;
    }
    const request = {
      user: ['users.getUsers', { id: [inputEntity(resolved)] }],
      chat: ['messages.getChats', { id: [id] }],
      channel: [
        'channels.getChannels',
        { id: [type === 'channel' ? this.channel(resolved) : null] },
      ],
    }[type];
    if (!request) {
      throw new TelegramError('Unknown peer type', { type: 'PEER_NOT_FOUND' });
    }
    await this.rpc(...request, options);
    const entity = this.peers.get(`${type}:${id}`);
    if (!entity) {
      throw new TelegramError('Entity not found', { type: 'PEER_NOT_FOUND' });
    }
    return entity;
  }

  getContacts(options) {
    return this.rpc('contacts.getContacts', { hash: 0n }, options);
  }

  async getGreetingStickers(options) {
    const result = await this.rpc(
      'messages.getStickers',
      { emoticon: '👋⭐️', hash: 0n },
      options
    );
    return result.stickers ?? [];
  }

  downloadFile(location, options) {
    return this.downloadMedia(location, options);
  }

  async downloadProfilePhoto(peer, { big = true, ...options } = {}) {
    const entity = await this.getEntity(peer, options);
    if (!entity.photo?.photo_id) {
      return new Uint8Array();
    }
    return this.downloadMedia(
      {
        _: 'inputPeerPhotoFileLocation',
        big,
        peer: await this.resolvePeer(entity, options),
        photo_id: entity.photo.photo_id,
      },
      { dc: entity.photo.dc_id, ...options }
    );
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
        peer: await this.resolvePeer(peer, options),
        message: text ?? (params.rich_message ? '' : text),
        random_id: params.random_id ?? randomId(),
      },
      options
    );
  }

  async getMessages(peer, options = {}) {
    const input = await this.resolvePeer(peer, options);
    const params = objectRequest(requestOf('messages.getHistory', options));
    if (options.ids) {
      const id = [].concat(options.ids).map((id) => {
        if (id && typeof id === 'object') {
          const input = normalize(id);
          if (
            [
              'inputMessageID',
              'inputMessageReplyTo',
              'inputMessagePinned',
              'inputMessageCallbackQuery',
            ].includes(input._)
          ) {
            return input;
          }
          id = input.id;
        }
        if (!Number.isSafeInteger(id) || id < 1 || id > 0x7fffffff) {
          throw new RangeError('Message IDs must be positive 32-bit integers');
        }
        return { _: 'inputMessageID', id };
      });
      const result =
        peerFamily(input) === 'channel'
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

  async getRichMessage(peer, message, options = {}) {
    options.signal?.throwIfAborted();
    const id = accountMessageId(message);
    const input = await this.resolvePeer(peer, options);
    const identity =
      input._ === 'inputPeerSelf' ? await this.getMe(options) : input;
    const family = identity._ === 'user' ? 'user' : peerFamily(identity);
    const peerId =
      identity._ === 'user' ? identity.id : identity[`${family}_id`];
    const result = await this.rpc(
      'messages.getRichMessage',
      { peer: input, id },
      options
    );
    options.signal?.throwIfAborted();
    return result.messages?.find(
      (value) =>
        value._ === 'message' &&
        value.id === id &&
        value.peer_id?._ ===
          `peer${family[0]?.toUpperCase()}${family.slice(1)}` &&
        samePeerId(value.peer_id[`${family}_id`], peerId)
    );
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

  iterDialogs(options) {
    return iterateDialogs(this, options);
  }

  async editMessage(peer, { id, text, message = text, ...options }) {
    return this.rpc(
      'messages.editMessage',
      { ...options, peer: await this.resolvePeer(peer, options), id, message },
      options
    );
  }

  channel(peer) {
    if (peerFamily(peer) !== 'channel') {
      throw new TypeError('This operation requires a channel or supergroup');
    }
    return inputEntity(peer);
  }

  async deleteMessages(peer, ids, options = {}) {
    const input = await this.resolvePeer(peer, options);
    return peerFamily(input) === 'channel'
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
    let schedule =
      options.scheduleDate ?? options.schedule_date ?? options.schedule;
    if (schedule instanceof Date) {
      schedule = Math.floor(schedule.getTime() / 1000);
    }
    const ids = [].concat(messages);
    const nonces =
      options.randomId ?? options.random_id ?? ids.map(() => randomId());
    if (!Array.isArray(nonces) || nonces.length !== ids.length) {
      throw new RangeError('Forward random ID count must match message IDs');
    }
    return this.rpc(
      'messages.forwardMessages',
      {
        ...options,
        schedule_date: schedule,
        from_peer: await this.resolvePeer(fromPeer, options),
        to_peer: await this.resolvePeer(peer, options),
        id: ids,
        random_id: nonces,
      },
      options
    );
  }

  async sendReaction(peer, id, reactions, big, addToRecent, options = {}) {
    options.signal?.throwIfAborted();
    const reaction = reactionList(reactions);
    const result = await this.rpc(
      'messages.sendReaction',
      {
        peer: await this.resolvePeer(peer, options),
        msg_id: id,
        reaction,
        big,
        add_to_recent: addToRecent,
      },
      options
    );
    options.signal?.throwIfAborted();
    return result;
  }

  async getReactionUsers(peer, id, options = {}) {
    options.signal?.throwIfAborted();
    const reaction =
      options.reaction === null || options.reaction === undefined
        ? undefined
        : reactionOf(options.reaction);
    const result = await this.rpc(
      'messages.getMessageReactionsList',
      {
        peer: await this.resolvePeer(peer, options),
        id,
        reaction,
        limit: options.limit ?? 100,
        offset: options.offset ?? '',
      },
      options
    );
    options.signal?.throwIfAborted();
    return result;
  }

  async pinMessage(
    peer,
    id,
    { notify = false, pmOneSide = false, unpin = false, ...options } = {}
  ) {
    return this.rpc(
      'messages.updatePinnedMessage',
      {
        peer: await this.resolvePeer(peer, options),
        id,
        silent: !notify,
        pm_oneside: pmOneSide,
        unpin,
      },
      options
    );
  }

  async markAsRead(peer, id, options) {
    const input = await this.resolvePeer(peer, options);
    if (peerFamily(input) === 'channel') {
      return this.rpc(
        'channels.readHistory',
        { channel: this.channel(input), max_id: id },
        options
      );
    }
    await this.rpc(
      'messages.readHistory',
      { peer: input, max_id: id },
      options
    );
    return true;
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
        peer: await this.resolvePeer(peer, options),
        q: query,
      },
      options
    );
    return result.messages ?? [];
  }

  async getParticipants(peer, options = {}) {
    const input = await this.resolvePeer(peer, options);
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
    if (typeof peer === 'string' && !/^-?\d+$/.test(peer)) {
      const link = parseTelegramLink(peer);
      if (link.type === 'invite') {
        return this.rpc(
          'messages.importChatInvite',
          { hash: link.hash },
          options
        );
      }
      if (link.type !== 'public') {
        throw new TelegramError('This link cannot grant channel membership', {
          type:
            link.type === 'privateMessage'
              ? 'INVITE_REQUIRED'
              : 'CHAT_LINK_NOT_JOINABLE',
        });
      }
      peer = await this.resolveLink(link, options);
    }
    return this.rpc(
      'channels.joinChannel',
      {
        channel: this.channel(await this.resolvePeer(peer, options)),
      },
      options
    );
  }

  checkChatInvite(hash, options) {
    if (typeof hash !== 'string' || !/^[a-zA-Z0-9_-]{1,4096}$/.test(hash)) {
      throw new TypeError('Invalid invite hash');
    }
    return this.rpc('messages.checkChatInvite', { hash }, options);
  }

  async getNotifySettings(peer, options) {
    return this.rpc(
      'account.getNotifySettings',
      {
        peer: await notificationPeer(this, normalize(peer), options),
      },
      options
    );
  }

  async leaveChat(peer, options) {
    const input = await this.resolvePeer(peer, options);
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
            peer: await this.resolvePeer(peer, options),
            folder_id: archive ? 1 : 0,
          },
        ],
      },
      options
    );
  }

  async muteChat(peer, input = {}) {
    const { settings, options } = notificationOptions(input);
    const ownedSettings = normalize(settings);
    return this.rpc(
      'account.updateNotifySettings',
      {
        peer: await notificationPeer(this, normalize(peer), options),
        settings: ownedSettings,
      },
      options
    );
  }

  async addContact(
    peer,
    { firstName = '', lastName = '', phone = '', ...options } = {}
  ) {
    const input = await this.resolvePeer(peer, options);
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
