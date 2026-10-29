import { randomInt } from 'node:crypto';
import { createSecretChatKeyExchange } from './secret-key-exchange.js';
import { throwFailures } from './errors.js';
import {
  bindSecretChat,
  restoreSecretHandshake,
  secretChatId,
  secretDecodedUser,
  secretLong,
  secretPublic,
  secretRequestUser,
} from './secret-handshake-state.js';

/** Pending initial RPC state. Snapshots contain private key material. */
export class SecretChatHandshake {
  #data;
  #busy = false;
  #readySaved = false;

  constructor({ state } = {}) {
    this.#data = restoreSecretHandshake(state);
    this.#readySaved = this.#data.phase === 'ready';
  }

  get state() {
    const data = this.#data;
    return {
      phase: data.phase,
      originator: data.originator,
      selfId: data.selfId,
      remoteId: data.remoteId,
      chatId: data.chatId,
    };
  }

  exportState() {
    const data = this.#data;
    return {
      version: 1,
      phase: data.phase,
      originator: data.originator,
      selfId: String(data.selfId),
      remoteId: String(data.remoteId),
      chatId: data.chatId,
      accessHash: data.accessHash === null ? null : String(data.accessHash),
      user: data.user,
      publicValue: data.publicValue.toString('base64'),
      remotePublic: data.remotePublic?.toString('base64') ?? null,
      exchange: data.exchange?.exportState() ?? null,
      key: data.key?.toString('base64') ?? null,
      fingerprint: data.fingerprint === null ? null : String(data.fingerprint),
    };
  }

  credentials() {
    if (this.#data.phase !== 'ready' || !this.#readySaved) {
      throw new Error('Secret chat handshake is not ready');
    }
    return {
      peer: this.#peer(),
      originator: this.#data.originator,
      key: Buffer.from(this.#data.key),
      fingerprint: this.#data.fingerprint,
    };
  }

  #peer() {
    return {
      _: 'inputEncryptedChat',
      chat_id: this.#data.chatId,
      access_hash: this.#data.accessHash,
    };
  }

  async #exclusive(save, signal, task) {
    if (typeof save !== 'function') {
      throw new TypeError(
        'Secret chat handshake requires a durable save callback'
      );
    }
    if (this.#busy) {
      throw new Error('Secret chat handshake operation already in progress');
    }
    signal?.throwIfAborted();
    this.#busy = true;
    try {
      return await task();
    } finally {
      this.#busy = false;
    }
  }

  submit(invoke, { save, ...options } = {}) {
    return this.#exclusive(save, options.signal, async () => {
      const data = this.#data;
      if (data.phase === 'discarded') {
        throw new Error('Secret chat has been discarded');
      }
      await save(this.exportState());
      this.#readySaved = data.phase === 'ready';
      options.signal?.throwIfAborted();
      if (!['requesting', 'accepting'].includes(data.phase)) {
        return this.state;
      }
      const method = data.originator
        ? 'messages.requestEncryption'
        : 'messages.acceptEncryption';
      const params = data.originator
        ? {
            user_id: secretDecodedUser(data.user),
            random_id: data.chatId,
            g_a: Buffer.from(data.publicValue),
          }
        : {
            peer: this.#peer(),
            g_b: Buffer.from(data.publicValue),
            key_fingerprint: data.fingerprint,
          };
      const chat = await invoke(method, params, options);
      return this.#apply(invoke, chat, save, options);
    });
  }

  apply(invoke, chat, { save, ...options } = {}) {
    return this.#exclusive(save, options.signal, () =>
      this.#apply(invoke, chat, save, options)
    );
  }

  async #apply(invoke, chat, save, options) {
    // Unrelated updates must never consume this chat's pending private exponent.
    if (secretChatId(chat?.id) !== this.#data.chatId) {
      throw new RangeError('Secret chat ID mismatch');
    }
    try {
      this.#readySaved = false;
      this.#receive(chat);
    } catch (error) {
      this.#clear();
      return rejectHandshake(invoke, this.#data.chatId, options, error, () =>
        save(this.exportState())
      );
    }
    await save(this.exportState());
    this.#readySaved = this.#data.phase === 'ready';
    options.signal?.throwIfAborted();
    return this.state;
  }

  #receive(chat) {
    const data = this.#data;
    if (['encryptedChatEmpty', 'encryptedChatDiscarded'].includes(chat._)) {
      this.#clear();
      return;
    }
    if (data.phase === 'discarded') {
      throw new Error('Secret chat has been discarded');
    }
    const accessHash = bindSecretChat(chat, data);
    if (chat._ === 'encryptedChatWaiting' && data.originator) {
      data.accessHash = accessHash;
      if (data.phase === 'requesting') {
        data.phase = 'waiting';
      }
      return;
    }
    if (chat._ !== 'encryptedChat') {
      throw new TypeError('Invalid secret chat handshake response');
    }
    const remotePublic = secretPublic(chat.g_a_or_b);
    const fingerprint = secretLong(chat.key_fingerprint, 'key fingerprint');
    if (data.exchange) {
      const result = data.exchange.complete(remotePublic, fingerprint);
      data.exchange = null;
      data.key = result.key;
      data.fingerprint = result.fingerprint;
      data.remotePublic = remotePublic;
    } else if (
      fingerprint !== data.fingerprint ||
      !data.remotePublic.equals(remotePublic)
    ) {
      throw new Error('Secret chat final public value or fingerprint mismatch');
    }
    data.accessHash = accessHash;
    data.phase = 'ready';
  }

  #clear() {
    this.#readySaved = false;
    this.#data.exchange?.destroy();
    this.#data.exchange = null;
    this.#data.key?.fill(0);
    this.#data.key = null;
    this.#data.fingerprint = null;
    this.#data.remotePublic = null;
    this.#data.phase = 'discarded';
  }

  destroy() {
    if (this.#busy) {
      throw new Error('Secret chat handshake operation already in progress');
    }
    this.#clear();
  }
}

async function rejectHandshake(invoke, chatId, options, error, save) {
  const failures = [error];
  try {
    await save?.();
    await invoke(
      'messages.discardEncryption',
      { chat_id: chatId },
      {
        signal: options.signal,
        timeout: options.timeout,
      }
    );
  } catch (failure) {
    failures.push(failure);
  }
  throwFailures(failures, 'Secret chat handshake and discard failed');
}

function initialState(data, exchange) {
  return {
    version: 1,
    phase: data.originator ? 'requesting' : 'accepting',
    selfId: String(data.selfId),
    remoteId: String(data.remoteId),
    originator: data.originator,
    chatId: data.chatId,
    accessHash: data.accessHash === null ? null : String(data.accessHash),
    user: data.user,
    publicValue: exchange.publicValue.toString('base64'),
    remotePublic: null,
    exchange: null,
    key: null,
    fingerprint: null,
  };
}

/** Prepare and persist with submit(); no request RPC is sent by this factory. */
export async function createSecretChatRequest(invoke, options = {}) {
  options.signal?.throwIfAborted();
  const selfId = secretLong(options.selfId, 'self ID', true);
  const user = secretRequestUser(options.user, selfId);
  const data = {
    ...user,
    selfId,
    originator: true,
    chatId: randomInt(1, 0x80000000),
    accessHash: null,
  };
  const { exchange, config } = await createSecretChatKeyExchange(
    invoke,
    options
  );
  try {
    const state = initialState(data, exchange);
    state.exchange = exchange.exportState();
    return { handshake: new SecretChatHandshake({ state }), config };
  } finally {
    exchange.destroy();
  }
}

/** Call only after the application has explicitly accepted the incoming chat. */
export async function createSecretChatAcceptance(invoke, options = {}) {
  options.signal?.throwIfAborted();
  const selfId = secretLong(options.selfId, 'self ID', true);
  const chat = options.chat;
  if (chat?._ !== 'encryptedChatRequested') {
    throw new TypeError('Expected an incoming encryptedChatRequested');
  }
  const data = {
    selfId,
    remoteId: secretLong(chat.admin_id, 'administrator ID', true),
    chatId: secretChatId(chat.id),
    originator: false,
    accessHash: null,
    user: null,
  };
  data.accessHash = bindSecretChat(chat, data);
  if (data.selfId === data.remoteId) {
    throw new RangeError('Secret chat participants must be different');
  }
  let remotePublic;
  try {
    remotePublic = secretPublic(chat.g_a);
  } catch (error) {
    return rejectHandshake(invoke, data.chatId, options, error);
  }
  const { exchange, config } = await createSecretChatKeyExchange(
    invoke,
    options
  );
  let key;
  try {
    const state = initialState(data, exchange);
    const result = exchange.complete(remotePublic);
    key = result.key;
    state.key = key.toString('base64');
    state.fingerprint = String(result.fingerprint);
    state.remotePublic = remotePublic.toString('base64');
    return { handshake: new SecretChatHandshake({ state }), config };
  } catch (error) {
    return await rejectHandshake(invoke, data.chatId, options, error);
  } finally {
    key?.fill(0);
    exchange.destroy();
  }
}
