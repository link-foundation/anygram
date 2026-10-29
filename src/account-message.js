import { AccountFile } from './account-file.js';
import { responseMessage } from './account-response.js';
import { randomId } from './random.js';
import { canonicalValue } from './requests.js';
import {
  messageButtonCount,
  messageButtons,
  getMessageButtons,
  clickMessage,
} from './account-buttons.js';

const contexts = new WeakMap();
const states = new WeakMap();
const scope = (message) => {
  const context = contexts.get(message);
  if (!context) {
    throw new TypeError('An account message view is required');
  }
  return context;
};
const tag = (value) => value?._;

export function bindAccountMessage(value, context, origin) {
  Object.setPrototypeOf(value, AccountMessage.prototype);
  contexts.set(value, context);
  const type = origin?._?.replace('inputPeer', '');
  const key = `${type?.toLowerCase()}Id`;
  states.set(value, {
    inputChat:
      tag(value.peerId) === `peer${type}` && value.peerId[key] === origin[key]
        ? origin
        : undefined,
  });
  return value;
}

function markedId(peer) {
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

function senderPeer(message) {
  return (
    message.fromId ??
    (message.post || (!message.out && tag(message.peerId) === 'peerUser')
      ? message.peerId
      : undefined)
  );
}

function entity(message, peer) {
  const type = tag(peer)?.slice(4).toLowerCase();
  const value = scope(message).operations.peers.get(
    `${type}:${peer?.[`${type}Id`]}`
  );
  return value && scope(message).viewEntity(value);
}

function input(message, peer) {
  if (!peer) {
    return undefined;
  }
  try {
    return scope(message).wrap(
      scope(message).operations.resolveObjectPeer(peer)
    );
  } catch (error) {
    if (error?.type !== 'PEER_NOT_FOUND') {
      throw error;
    }
    return undefined;
  }
}

async function target(message, options) {
  const peer = await message.getInputChat(options);
  if (!peer) {
    throw new TypeError('Message input chat is unavailable');
  }
  return peer;
}

async function fetchEntity(message, type, options) {
  options?.signal?.throwIfAborted();
  if (message[type]) {
    return message[type];
  }
  const method = type === 'chat' ? 'getInputChat' : 'getInputSender';
  const peer = await message[method](options);
  const context = scope(message);
  return (
    peer && context.wrap(await context.operations.getEntity(peer, options))
  );
}

class AccountMessage {
  get buttonCount() {
    return messageButtonCount(this);
  }
  get buttons() {
    return messageButtons(this, scope(this), states.get(this));
  }
  getButtons(options) {
    return getMessageButtons(this, scope(this), states.get(this), options);
  }
  click(options) {
    return clickMessage(this, scope(this), states.get(this), options);
  }
  get client() {
    return scope(this).style;
  }
  get chatId() {
    return markedId(this.peerId);
  }
  get senderId() {
    return markedId(senderPeer(this));
  }
  get chat() {
    return entity(this, this.peerId);
  }
  get sender() {
    return entity(this, senderPeer(this));
  }
  get inputChat() {
    return states.get(this).inputChat ?? input(this, this.peerId);
  }
  get inputSender() {
    return input(this, senderPeer(this));
  }
  get isPrivate() {
    return this.peerId ? tag(this.peerId) === 'peerUser' : undefined;
  }
  get isChannel() {
    return tag(this.peerId) === 'peerChannel';
  }
  get isGroup() {
    if (!this.isChannel) {
      return tag(this.peerId) === 'peerChat';
    }
    let broadcast = this.post;
    if (!broadcast && this.chat) {
      broadcast = Boolean(this.chat.broadcast);
    }
    return broadcast === undefined ? undefined : !broadcast;
  }
  get isReply() {
    return Boolean(this.replyTo);
  }
  get replyToMsgId() {
    return this.replyTo?.replyToMsgId;
  }
  get rawText() {
    return this.message || '';
  }
  set rawText(value) {
    this.message = value;
    this.entities = [];
  }
  get text() {
    return this.rawText;
  }
  set text(value) {
    this.rawText = value;
  }

  async getInputChat(options) {
    options?.signal?.throwIfAborted();
    if (this.inputChat || !this.peerId) {
      return this.inputChat;
    }
    for await (const dialog of scope(this).operations.iterDialogs({
      ...options,
      limit: 100,
      maxPages: 1,
    })) {
      if (markedId(scope(this).wrap(dialog.dialog.peer)) === this.chatId) {
        return scope(this).wrap(dialog.inputPeer);
      }
    }
    return undefined;
  }
  getChat(options) {
    return fetchEntity(this, 'chat', options);
  }
  getInputSender(options) {
    options?.signal?.throwIfAborted();
    return Promise.resolve(this.inputSender);
  }
  getSender(options) {
    return fetchEntity(this, 'sender', options);
  }

  async getReplyMessage(options = {}) {
    options.signal?.throwIfAborted();
    const state = states.get(this);
    if (!this.replyTo || state.reply) {
      return state.reply;
    }
    const peer = await target(this, options);
    const operations = scope(this).operations;
    const [reply] = await operations.getMessages(peer, {
      ...options,
      ids: { _: 'inputMessageReplyTo', id: this.id },
    });
    if (reply && reply._ !== 'messageEmpty') {
      state.reply = scope(this).wrap(reply, peer);
    } else if (this.replyToMsgId) {
      const [fallback] = await operations.getMessages(peer, {
        ...options,
        ids: this.replyToMsgId,
      });
      if (fallback && fallback._ !== 'messageEmpty') {
        state.reply = scope(this).wrap(fallback, peer);
      }
    }
    return state.reply;
  }

  async respond(params = {}) {
    const peer = await target(this, params);
    const nonce = params.randomId ?? params.random_id ?? randomId();
    const options = {
      ...params,
      randomId: nonce,
      noWebpage:
        params.linkPreview === undefined
          ? params.noWebpage
          : !params.linkPreview,
      replyMarkup: params.buttons ?? params.replyMarkup,
      entities: params.formattingEntities ?? params.entities,
      scheduleDate: params.schedule ?? params.scheduleDate,
    };
    const result = await scope(this).operations.sendMessage(
      peer,
      params.message,
      options
    );
    return responseMessage(scope(this), result, {
      peer,
      text: params.message,
      replyTo: params.replyTo,
      randomId: nonce,
      entities: options.entities,
    });
  }
  reply(params = {}) {
    return this.respond({ ...params, replyTo: this.id });
  }
  async edit(params = {}) {
    params.signal?.throwIfAborted();
    if (this.fwdFrom) {
      return undefined;
    }
    const {
      message,
      linkPreview,
      buttons,
      formattingEntities,
      schedule,
      ...options
    } = params;
    void message;
    const peer = await target(this, params);
    const result = await scope(this).operations.editMessage(peer, {
      ...options,
      id: this.id,
      noWebpage: !(linkPreview ?? Boolean(this.webPreview)),
      replyMarkup: buttons ?? this.replyMarkup,
      entities: formattingEntities,
      scheduleDate: schedule,
    });
    return responseMessage(scope(this), result, { peer, id: this.id });
  }
  async delete(options = {}) {
    const revoke = options.revoke ?? scope(this).kind === 'teleproto';
    return [
      scope(this).wrap(
        await scope(this).operations.deleteMessages(
          await target(this, options),
          [this.id],
          { ...options, revoke }
        )
      ),
    ];
  }
  async forwardTo(peer, options = {}) {
    const destination = await scope(this).operations.resolvePeer(peer, options);
    const nonce = randomId();
    const result = await scope(this).operations.forwardMessages(destination, {
      ...options,
      fromPeer: await target(this, options),
      messages: [this.id],
      randomId: [nonce],
    });
    return responseMessage(scope(this), result, {
      peer: scope(this).wrap(destination),
      randomId: nonce,
      all: true,
    });
  }
  downloadMedia(options = {}) {
    return scope(this).operations.downloadMedia(canonicalValue(this), options);
  }

  async pin(options = {}) {
    const peer = await target(this, options);
    const result = await scope(this).operations.pinMessage(
      peer,
      this.id,
      options
    );
    return responseMessage(scope(this), result, { peer });
  }
  async unpin(options = {}) {
    await scope(this).operations.pinMessage(
      await target(this, options),
      this.id,
      { ...options, unpin: true }
    );
  }
  async markAsRead(options = {}) {
    return scope(this).operations.markAsRead(
      await target(this, options),
      this.id,
      options
    );
  }

  get file() {
    const state = states.get(this);
    const media = this.photo ?? this.document;
    if (!state.file && media) {
      state.file = new AccountFile(media);
    }
    return state.file;
  }

  get webPreview() {
    return tag(this.media?.webpage) === 'webPage'
      ? this.media.webpage
      : undefined;
  }
  get photo() {
    if (tag(this.media) === 'messageMediaPhoto') {
      return tag(this.media.photo) === 'photo' ? this.media.photo : undefined;
    }
    if (tag(this.action) === 'messageActionChatEditPhoto') {
      return this.action.photo;
    }
    return tag(this.webPreview?.photo) === 'photo'
      ? this.webPreview.photo
      : undefined;
  }
  get document() {
    const document =
      tag(this.media) === 'messageMediaDocument'
        ? this.media.document
        : this.webPreview?.document;
    return tag(document) === 'document' ? document : undefined;
  }
  get contact() {
    return tag(this.media) === 'messageMediaContact' ? this.media : undefined;
  }
  get game() {
    return tag(this.media) === 'messageMediaGame' ? this.media.game : undefined;
  }
  get geo() {
    return [
      'messageMediaGeo',
      'messageMediaGeoLive',
      'messageMediaVenue',
    ].includes(tag(this.media))
      ? this.media.geo
      : undefined;
  }
  get invoice() {
    return tag(this.media) === 'messageMediaInvoice' ? this.media : undefined;
  }
  get poll() {
    return tag(this.media) === 'messageMediaPoll' ? this.media : undefined;
  }
  get venue() {
    return tag(this.media) === 'messageMediaVenue' ? this.media : undefined;
  }
  get dice() {
    return tag(this.media) === 'messageMediaDice' ? this.media : undefined;
  }
  get audio() {
    return documentAttribute(
      this,
      'documentAttributeAudio',
      (attribute) => !attribute.voice
    );
  }
  get voice() {
    return documentAttribute(this, 'documentAttributeAudio', (attribute) =>
      Boolean(attribute.voice)
    );
  }
  get video() {
    return documentAttribute(this, 'documentAttributeVideo');
  }
  get videoNote() {
    return documentAttribute(this, 'documentAttributeVideo', (attribute) =>
      Boolean(attribute.roundMessage)
    );
  }
  get gif() {
    return documentAttribute(this, 'documentAttributeAnimated');
  }
  get sticker() {
    return documentAttribute(this, 'documentAttributeSticker');
  }
  getEntitiesText(Class) {
    if (!this.entities?.length) {
      return undefined;
    }
    return this.entities
      .filter((entry) => !Class || entry.className === Class.className)
      .map((entry) => [
        entry,
        this.rawText.slice(entry.offset, entry.offset + entry.length),
      ]);
  }
}

function documentAttribute(message, type, predicate) {
  const attribute = message.document?.attributes.find(
    (entry) => tag(entry) === type
  );
  return attribute && (!predicate || predicate(attribute))
    ? message.document
    : undefined;
}
