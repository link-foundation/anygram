import { hash, validateDhParameters, validateDhPublic } from './crypto.js';
import { SecretChatKeyExchange } from './secret-key-exchange.js';
import {
  secretDecodedBytes,
  secretLong,
  secretKeyTime as timestamp,
} from './secret-handshake-state.js';
import { secretLimit } from './secret-sequence-state.js';
import { TelegramError } from './errors.js';
import { randomId } from './random.js';

const empty = () => ({ actions: [], installBeforeActions: false });
const count = (value) => secretLimit(value, 0, 0x7fffffff, 'key usage count');
const rejectOther = (id, pendingId) => ({
  ...empty(),
  actions: id === pendingId ? [] : [abortAction(id)],
});

/** Re-keying actions only; persist them atomically with sequence/key changes. */
export class SecretChatRekey {
  #p;
  #g;
  #phase = 'idle';
  #id = null;
  #exchange;
  #public;
  #key;
  #fingerprint = null;
  #createdAt;
  #sent = 0;
  #received = 0;
  #now;
  #destroyed = false;

  constructor({
    p,
    g,
    state,
    createdAt,
    now = () => Math.floor(Date.now() / 1000),
  } = {}) {
    if (typeof now !== 'function') {
      throw new TypeError('Secret chat re-keying clock must be a function');
    }
    this.#now = now;
    this.#p = state
      ? secretDecodedBytes(state.p, 256, 256, 're-keying prime')
      : p;
    this.#g = state ? state.g : g;
    validateDhParameters(this.#p, this.#g);
    this.#p = Buffer.from(this.#p);
    this.#createdAt = timestamp(
      state ? state.createdAt : createdAt === undefined ? now() : createdAt
    );
    if (state !== undefined) {
      try {
        this.#restore(state);
      } catch (error) {
        this.destroy();
        throw error;
      }
    }
  }

  #restore(state) {
    if (
      state?.version !== 1 ||
      !['idle', 'requesting', 'accepted', 'committed'].includes(state.phase)
    ) {
      throw new TypeError('Invalid secret chat re-keying state');
    }
    this.#sent = count(state.sent);
    this.#received = count(state.received);
    this.#phase = state.phase;
    if (this.#phase === 'idle') {
      if (
        [
          state.exchangeId,
          state.publicValue,
          state.exchange,
          state.key,
          state.fingerprint,
        ].some((value) => value !== null)
      ) {
        throw new TypeError('Idle re-keying state retains private material');
      }
      return;
    }
    this.#id = secretLong(state.exchangeId, 'exchange ID');
    this.#public = secretDecodedBytes(
      state.publicValue,
      256,
      256,
      're-keying public value'
    );
    validateDhPublic(validateDhParameters(this.#p, this.#g), this.#public);
    if (this.#phase === 'requesting') {
      if (state.key !== null || state.fingerprint !== null) {
        throw new TypeError('Requesting re-keying state already has a key');
      }
      this.#exchange = new SecretChatKeyExchange({
        p: this.#p,
        g: this.#g,
        state: state.exchange,
      });
      if (!this.#public.equals(this.#exchange.publicValue)) {
        throw new Error('Restored re-keying public value mismatch');
      }
    } else {
      if (state.exchange !== null) {
        throw new TypeError('Completed re-keying retains a private exponent');
      }
      this.#key = secretDecodedBytes(state.key, 256, 256, 're-keying key');
      this.#fingerprint = secretLong(
        state.fingerprint,
        're-keying fingerprint'
      );
      if (hash('sha1', this.#key).readBigInt64LE(12) !== this.#fingerprint) {
        throw new Error('Restored re-keying fingerprint mismatch');
      }
    }
  }

  #active() {
    if (this.#destroyed) {
      throw new Error('Secret chat re-keying has been destroyed');
    }
  }

  get state() {
    this.#active();
    return {
      phase: this.#phase,
      exchangeId: this.#id,
      fingerprint: this.#fingerprint,
      createdAt: this.#createdAt,
      sent: this.#sent,
      received: this.#received,
    };
  }

  get candidate() {
    this.#active();
    return this.#key
      ? { key: Buffer.from(this.#key), fingerprint: this.#fingerprint }
      : undefined;
  }

  record({ sent = 0, received = 0 } = {}) {
    this.#active();
    const nextSent = count(this.#sent + count(sent));
    const nextReceived = count(this.#received + count(received));
    this.#sent = nextSent;
    this.#received = nextReceived;
  }

  shouldRotate(now = this.#now()) {
    this.#active();
    timestamp(now);
    return (
      this.#phase === 'idle' &&
      (this.#sent + this.#received > 100 ||
        (this.#sent > 0 && now - this.#createdAt >= 7 * 24 * 60 * 60))
    );
  }

  request(exchangeId = randomId()) {
    this.#active();
    if (this.#phase !== 'idle') {
      throw new Error('Secret chat re-keying is already in progress');
    }
    const id = secretLong(exchangeId, 'exchange ID');
    const exchange = new SecretChatKeyExchange({ p: this.#p, g: this.#g });
    this.#exchange = exchange;
    this.#public = exchange.publicValue;
    this.#id = id;
    this.#phase = 'requesting';
    return this.pendingAction();
  }

  pendingAction() {
    this.#active();
    const exchange_id = this.#id;
    if (this.#phase === 'requesting') {
      return {
        _: 'decryptedMessageActionRequestKey',
        exchange_id,
        g_a: Buffer.from(this.#public),
      };
    }
    if (this.#phase === 'accepted') {
      return {
        _: 'decryptedMessageActionAcceptKey',
        exchange_id,
        g_b: Buffer.from(this.#public),
        key_fingerprint: this.#fingerprint,
      };
    }
    if (this.#phase === 'committed') {
      return {
        _: 'decryptedMessageActionCommitKey',
        exchange_id,
        key_fingerprint: this.#fingerprint,
      };
    }
    return undefined;
  }

  receive(action) {
    this.#active();
    try {
      return this.#receive(action);
    } catch (cause) {
      this.destroy();
      throw new TelegramError('Invalid secret chat re-keying message', {
        type: 'SECRET_CHAT_REKEY_INVALID',
        cause,
      });
    }
  }

  #receive(action) {
    const id = secretLong(action?.exchange_id, 'exchange ID');
    if (action._ === 'decryptedMessageActionRequestKey') {
      return this.#requestReceived(action, id);
    }
    if (action._ === 'decryptedMessageActionAbortKey') {
      if (id === this.#id) {
        if (this.#phase === 'committed') {
          throw new Error('Cannot abort an already committed key');
        }
        this.#clear();
      }
      return empty();
    }
    if (action._ === 'decryptedMessageActionAcceptKey') {
      return this.#acceptReceived(action, id);
    }
    if (action._ === 'decryptedMessageActionCommitKey') {
      return this.#commitReceived(action, id);
    }
    throw new TypeError('Unsupported secret chat re-keying action');
  }

  #requestReceived(action, id) {
    if (this.#phase === 'requesting') {
      if (this.#id > id) {
        return empty();
      }
      if (this.#id === id) {
        this.#clear();
        return empty();
      }
    } else if (this.#phase !== 'idle') {
      return rejectOther(id, this.#id);
    }
    const exchange =
      this.#exchange ?? new SecretChatKeyExchange({ p: this.#p, g: this.#g });
    try {
      this.#public = exchange.publicValue;
      const result = exchange.complete(action.g_a);
      this.#key = result.key;
      this.#fingerprint = result.fingerprint;
    } finally {
      exchange.destroy();
      this.#exchange = undefined;
    }
    this.#id = id;
    this.#phase = 'accepted';
    return { ...empty(), actions: [this.pendingAction()] };
  }

  #acceptReceived(action, id) {
    if (id !== this.#id || this.#phase !== 'requesting') {
      return rejectOther(id, this.#id);
    }
    const fingerprint = secretLong(
      action.key_fingerprint,
      're-keying fingerprint'
    );
    const result = this.#exchange.complete(action.g_b, fingerprint);
    this.#exchange = undefined;
    this.#key = result.key;
    this.#fingerprint = result.fingerprint;
    this.#phase = 'committed';
    this.#installed();
    return {
      ...empty(),
      actions: [this.pendingAction()],
      install: this.candidate,
    };
  }

  #commitReceived(action, id) {
    if (id !== this.#id || this.#phase !== 'accepted') {
      return empty();
    }
    if (
      secretLong(action.key_fingerprint, 're-keying fingerprint') !==
      this.#fingerprint
    ) {
      throw new Error('Secret chat commit fingerprint mismatch');
    }
    return this.#finishAccepted();
  }

  #installed() {
    const now = timestamp(this.#now());
    this.#createdAt = now;
    this.#sent = 0;
    this.#received = 0;
  }

  #finishAccepted() {
    this.#installed();
    const install = this.candidate;
    this.#clear();
    return {
      actions: [{ _: 'decryptedMessageActionNoop' }],
      install,
      installBeforeActions: true,
    };
  }

  /** Only call for an authenticated message using the candidate key. */
  confirm(fingerprint) {
    this.#active();
    if (
      secretLong(fingerprint, 'confirmed key fingerprint') !== this.#fingerprint
    ) {
      return empty();
    }
    if (this.#phase === 'accepted') {
      return this.#finishAccepted();
    }
    if (this.#phase === 'committed') {
      this.#clear();
    }
    return empty();
  }

  abort() {
    this.#active();
    if (['accepted', 'committed'].includes(this.#phase)) {
      throw new Error('Cannot abort re-keying after accepting or committing');
    }
    const action =
      this.#phase === 'requesting' ? abortAction(this.#id) : undefined;
    this.#clear();
    return action;
  }

  #clear() {
    this.#exchange?.destroy();
    this.#key?.fill(0);
    this.#exchange = undefined;
    this.#key = undefined;
    this.#public = undefined;
    this.#id = null;
    this.#fingerprint = null;
    this.#phase = 'idle';
  }

  exportState() {
    this.#active();
    return {
      version: 1,
      p: this.#p.toString('base64'),
      g: this.#g,
      phase: this.#phase,
      exchangeId: this.#id === null ? null : String(this.#id),
      publicValue: this.#public?.toString('base64') ?? null,
      exchange: this.#exchange?.exportState() ?? null,
      key: this.#key?.toString('base64') ?? null,
      fingerprint:
        this.#fingerprint === null ? null : String(this.#fingerprint),
      createdAt: this.#createdAt,
      sent: this.#sent,
      received: this.#received,
    };
  }

  destroy() {
    this.#clear();
    this.#destroyed = true;
  }
}

function abortAction(exchange_id) {
  return { _: 'decryptedMessageActionAbortKey', exchange_id };
}
