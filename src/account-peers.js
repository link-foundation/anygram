const contexts = new WeakMap();
const tag = (value) => value?._;
const peers = (value) => contexts.get(value);

export function markedPeerId(peer) {
  const type = tag(peer)?.slice(4).toLowerCase();
  const id = peer?.[`${type}Id`];
  if (id === undefined) {
    return undefined;
  }
  return type === 'channel'
    ? BigInt(`-100${id}`)
    : type === 'chat'
      ? -BigInt(id)
      : BigInt(id);
}

export function cachedPeer(context, peer) {
  const type = tag(peer)?.slice(4).toLowerCase();
  const value = context.operations.peers.get(`${type}:${peer?.[`${type}Id`]}`);
  return value && context.viewEntity(value);
}

function fromMessage(value, peer) {
  const state = peers(value);
  const origin = state.source
    ? state.source.inputChat
    : (state.inputChat ?? state.origin);
  if (
    !origin ||
    !Number.isSafeInteger(state.id) ||
    state.id < 1 ||
    state.id > 0x7fffffff
  ) {
    return undefined;
  }
  const type = tag(peer)?.slice(4);
  if (!['User', 'Channel'].includes(type)) {
    return undefined;
  }
  return state.context.wrap({
    _: `inputPeer${type}FromMessage`,
    peer: origin,
    msg_id: state.id,
    [`${type.toLowerCase()}_id`]: peer[`${type.toLowerCase()}Id`],
  });
}

function input(value, peer) {
  if (!peer) {
    return undefined;
  }
  const state = peers(value);
  const { context } = state;
  const type = tag(peer)?.slice(4).toLowerCase();
  const key = `${type}:${peer[`${type}Id`]}`;
  const entity = context.operations.peers.get(key);
  const saved = state.inputs.get(key);
  if (saved && saved.entity === entity) {
    return saved.input;
  }
  let resolved;
  try {
    resolved =
      (hasMinAccessHash(entity) && fromMessage(value, peer)) ||
      context.wrap(context.operations.resolveObjectPeer(peer));
  } catch (error) {
    if (error?.type !== 'PEER_NOT_FOUND') {
      throw error;
    }
    resolved = cachedPeer(context, peer)?.min
      ? fromMessage(value, peer)
      : undefined;
  }
  if (resolved) {
    state.inputs.set(key, { entity, input: resolved });
    if (state.inputs.size > 4) {
      state.inputs.delete(state.inputs.keys().next().value);
    }
  }
  return resolved;
}

export function bindAccountPeers(value, context, settings) {
  contexts.set(value, { context, inputs: new Map(), ...settings });
}

async function fetchEntity(value, name, options) {
  options?.signal?.throwIfAborted();
  const cached = value[name];
  if (cached && !cached.min) {
    return cached;
  }
  const method = name === 'chat' ? 'getInputChat' : 'getInputSender';
  const peer = await value[method](options);
  options?.signal?.throwIfAborted();
  if (!peer) {
    return cached;
  }
  const { context } = peers(value);
  const entity = await context.operations.getEntity(peer, options);
  options?.signal?.throwIfAborted();
  return context.viewEntity(entity);
}

async function reloadSender(value, options) {
  const state = peers(value);
  const origin = state.source
    ? await state.source.getInputChat(options)
    : await value.getInputChat(options);
  if (!origin) {
    state.senderReloaded = true;
    return undefined;
  }
  await state.context.operations.getMessages(origin, {
    ...options,
    ids: state.id,
  });
  options?.signal?.throwIfAborted();
  state.senderReloaded = true;
  state.senderFallback = fromMessage(value, state.senderPeer());
}

export class AccountPeerView {
  get client() {
    return peers(this).context.style;
  }
  get chatId() {
    return markedPeerId(peers(this).chatPeer());
  }
  get senderId() {
    return markedPeerId(peers(this).senderPeer());
  }
  get chat() {
    return cachedPeer(peers(this).context, peers(this).chatPeer());
  }
  get sender() {
    return cachedPeer(peers(this).context, peers(this).senderPeer());
  }
  get inputChat() {
    const state = peers(this);
    return state.inputChat ?? input(this, state.chatPeer());
  }
  get inputSender() {
    const state = peers(this);
    return input(this, state.senderPeer()) ?? state.senderFallback;
  }
  get isPrivate() {
    const peer = peers(this).chatPeer();
    return peer ? tag(peer) === 'peerUser' : undefined;
  }
  get isChannel() {
    return tag(peers(this).chatPeer()) === 'peerChannel';
  }
  get isGroup() {
    if (!this.isChannel) {
      return tag(peers(this).chatPeer()) === 'peerChat';
    }
    let broadcast = this.post;
    if (!broadcast && this.chat) {
      broadcast = Boolean(this.chat.broadcast);
    }
    return broadcast === undefined ? undefined : !broadcast;
  }
  async getInputChat(options) {
    options?.signal?.throwIfAborted();
    if (this.inputChat || !peers(this).chatPeer()) {
      return this.inputChat;
    }
    const { context } = peers(this);
    for await (const dialog of context.operations.iterDialogs({
      ...options,
      limit: 100,
      maxPages: 1,
    })) {
      options?.signal?.throwIfAborted();
      if (markedPeerId(context.wrap(dialog.dialog.peer)) === this.chatId) {
        peers(this).inputChat = context.wrap(dialog.inputPeer);
        return this.inputChat;
      }
    }
    return undefined;
  }
  getChat(options) {
    return fetchEntity(this, 'chat', options);
  }
  async getInputSender(options) {
    options?.signal?.throwIfAborted();
    const state = peers(this);
    if (!this.inputSender && state.senderPeer() && !state.senderReloaded) {
      state.senderReload ??= reloadSender(this, options).finally(() => {
        state.senderReload = undefined;
      });
      await state.senderReload;
      options?.signal?.throwIfAborted();
    }
    return this.inputSender;
  }
  getSender(options) {
    return fetchEntity(this, 'sender', options);
  }
}

class AccountForward extends AccountPeerView {
  constructor(original, context, source) {
    super();
    this.originalFwd = original;
    bindAccountPeers(this, context, {
      chatPeer: () =>
        tag(original.fromId) === 'peerUser' ? undefined : original.fromId,
      senderPeer: () =>
        tag(original.fromId) === 'peerUser' ? original.fromId : undefined,
      source,
      id: source.id,
    });
  }
}

export const accountForward = (original, context, source) =>
  new AccountForward(original, context, source);
import { hasMinAccessHash } from './peer-cache.js';
