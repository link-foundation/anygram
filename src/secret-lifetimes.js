import { secretLimit } from './secret-sequence-state.js';
import {
  lifetimeTime,
  lifetimeDirection,
  lifetimeEntry,
  lifetimeKey,
  lifetimeCopy,
  lifetimeIds,
  lifetimeTTL,
} from './secret-lifetime-state.js';

/** Bounded expiry metadata; persist drafts with the application's message store. */
export class SecretChatLifetimes {
  #messages = new Map();
  #maxMessages;

  constructor({ state, maxMessages } = {}) {
    this.#maxMessages = secretLimit(
      maxMessages ?? state?.maxMessages ?? 1000,
      1,
      10000,
      'lifetime message limit'
    );
    if (state === undefined) {
      return;
    }
    if (
      state?.version !== 1 ||
      state.maxMessages !== this.#maxMessages ||
      !Array.isArray(state.messages) ||
      state.messages.length > this.#maxMessages
    ) {
      throw new TypeError('Invalid secret lifetime state');
    }
    for (const value of state.messages) {
      if (typeof value?.randomId !== 'string') {
        throw new TypeError('Expected a portable lifetime random ID');
      }
      const entry = lifetimeEntry(value);
      const key = lifetimeKey(entry);
      if (this.#messages.has(key)) {
        throw new TypeError('Duplicate secret lifetime message');
      }
      this.#messages.set(key, entry);
    }
  }

  get size() {
    return this.#messages.size;
  }

  get nextExpiration() {
    let next = null;
    for (const entry of this.#messages.values()) {
      if (entry.readAt !== null) {
        const expires = entry.readAt + entry.ttl;
        next = next === null ? expires : Math.min(next, expires);
      }
    }
    return next;
  }

  track(message, options) {
    if (message?._ !== 'decryptedMessage') {
      throw new TypeError('Expected a decrypted secret message');
    }
    const ttl = lifetimeTTL(message);
    const entry = lifetimeEntry({
      ...options,
      randomId: message.random_id,
      ttl: ttl || 1,
      readAt: null,
    });
    const key = lifetimeKey(entry);
    const previous = this.#messages.get(key);
    if (previous) {
      if (
        ttl !== previous.ttl ||
        entry.date !== previous.date ||
        entry.startOn !== previous.startOn
      ) {
        throw new TypeError('Conflicting secret lifetime message replay');
      }
      return false;
    }
    if (!ttl) {
      return false;
    }
    if (this.size >= this.#maxMessages) {
      throw new RangeError('Secret lifetime message limit exceeded');
    }
    this.#messages.set(key, entry);
    return true;
  }

  #start(matches, at) {
    const started = [];
    for (const entry of this.#messages.values()) {
      if (entry.readAt === null && matches(entry)) {
        entry.readAt = at;
        started.push(lifetimeCopy(entry));
      }
    }
    return started;
  }

  /** An explicit content-read ID also starts an unopened media lifetime. */
  read(ids, { outgoing, at } = {}) {
    const selected = lifetimeIds(ids);
    lifetimeDirection(outgoing);
    lifetimeTime(at);
    return this.#start(
      (entry) => entry.outgoing === outgoing && selected.has(entry.randomId),
      at
    );
  }

  /** Use max_date/date for remote history updates; UI reads use their own time. */
  readThrough(maxDate, { outgoing, at } = {}) {
    lifetimeTime(maxDate);
    lifetimeDirection(outgoing);
    lifetimeTime(at);
    return this.#start(
      (entry) =>
        entry.outgoing === outgoing &&
        entry.date <= maxDate &&
        entry.startOn === 'read',
      Math.max(maxDate, at)
    );
  }

  #remove(matches) {
    const removed = [];
    for (const [key, entry] of this.#messages) {
      if (matches(entry)) {
        removed.push(lifetimeCopy(entry));
        this.#messages.delete(key);
      }
    }
    return removed;
  }

  remove(ids, { outgoing } = {}) {
    const selected = lifetimeIds(ids);
    if (outgoing !== undefined) {
      lifetimeDirection(outgoing);
    }
    return this.#remove(
      (entry) =>
        selected.has(entry.randomId) &&
        (outgoing === undefined || entry.outgoing === outgoing)
    );
  }

  clear() {
    return this.#remove(() => true);
  }

  expire(at) {
    secretLimit(at, 0, Number.MAX_SAFE_INTEGER, 'expiry time');
    return this.#remove(
      (entry) => entry.readAt !== null && entry.readAt + entry.ttl <= at
    );
  }

  /** Apply only authenticated, ordered incoming services from session effects. */
  applyService(action, { at } = {}) {
    const result = { started: [], removed: [] };
    if (action?._ === 'decryptedMessageActionReadMessages') {
      result.started = this.read(action.random_ids, { outgoing: true, at });
    } else if (action?._ === 'decryptedMessageActionDeleteMessages') {
      result.removed = this.remove(action.random_ids);
    } else if (action?._ === 'decryptedMessageActionFlushHistory') {
      result.removed = this.clear();
    }
    return result;
  }

  exportState() {
    return {
      version: 1,
      maxMessages: this.#maxMessages,
      messages: [...this.#messages.values()].map((entry) => ({
        ...entry,
        randomId: String(entry.randomId),
      })),
    };
  }
}
