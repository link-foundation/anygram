/** Bounded, timer-free storage accepting both bot-framework store interfaces. */
export class MemorySessionStore {
  constructor(options = {}) {
    const {
      ttl = Infinity,
      maxEntries = 10000,
      now = Date.now,
    } = typeof options === 'number' ? { ttl: options } : options;
    if (
      typeof ttl !== 'number' ||
      !(ttl >= 0) ||
      !Number.isSafeInteger(maxEntries) ||
      maxEntries < 1
    ) {
      throw new RangeError('Invalid session TTL or entry limit');
    }
    Object.assign(this, { ttl, maxEntries, now });
    this.entries = new Map();
  }
  get size() {
    return this.entries.size;
  }
  get(key) {
    const entry = this.entries.get(key);
    if (!entry) {
      return undefined;
    }
    this.entries.delete(key);
    if (entry.expires <= this.now()) {
      return undefined;
    }
    this.entries.set(key, entry);
    return entry.value;
  }
  set(key, value) {
    this.entries.delete(key);
    this.entries.set(key, { value, expires: this.now() + this.ttl });
    if (this.entries.size > this.maxEntries) {
      this.entries.delete(this.entries.keys().next().value);
    }
  }
  delete(key) {
    this.entries.delete(key);
  }
  read(key) {
    return this.get(key);
  }
  write(key, value) {
    this.set(key, value);
  }
}

export { MemorySessionStore as MemorySessionStorage };

function storageMethods(store) {
  const read = store.read ?? store.get;
  const write = store.write ?? store.set;
  if (
    ![read, write, store.delete].every((method) => typeof method === 'function')
  ) {
    throw new TypeError(
      'Session storage needs read/write/delete or get/set/delete'
    );
  }
  return {
    read: read.bind(store),
    write: write.bind(store),
    delete: store.delete.bind(store),
  };
}

function serialSessions(maxPending) {
  if (!Number.isSafeInteger(maxPending) || maxPending < 1) {
    throw new RangeError('maxPending must be a positive safe integer');
  }
  const tails = new Map();
  let pending = 0;
  return async (key, run) => {
    if (pending >= maxPending) {
      throw new Error('Session middleware pending limit exceeded');
    }
    pending++;
    const previous = tails.get(key);
    let release;
    const turn = new Promise((resolve) => {
      release = resolve;
    });
    tails.set(key, turn);
    try {
      await previous;
      return await run();
    } finally {
      release();
      pending--;
      if (tails.get(key) === turn) {
        tails.delete(key);
      }
    }
  };
}

function defaultKey(ctx, style) {
  const chat = ctx.chatId ?? ctx.chat?.id;
  if (style === 'grammy') {
    return chat === undefined ? undefined : String(chat);
  }
  return ctx.from?.id === undefined || chat === undefined
    ? undefined
    : `${ctx.from.id}:${chat}`;
}

function sessionProperty(ctx, property, value, missing) {
  let touched = false;
  Object.defineProperty(ctx, property, {
    enumerable: true,
    configurable: true,
    get() {
      if (missing) {
        throw new Error('Session key is undefined for this update');
      }
      touched = true;
      return value;
    },
    set(next) {
      if (missing) {
        throw new Error('Session key is undefined for this update');
      }
      touched = true;
      value = next;
    },
  });
  return { value: () => value, touched: () => touched };
}

/** Both framework styles use the same storage, cloning and per-key ordering. */
function createSession(options, style) {
  const property = options.property ?? 'session';
  if (['__proto__', 'prototype', 'constructor'].includes(property)) {
    throw new TypeError('Invalid session property');
  }
  const storage = storageMethods(
    options.storage ?? options.store ?? new MemorySessionStore()
  );
  const initial = options.initial ?? options.defaultSession;
  const getKey = options.getSessionKey ?? ((ctx) => defaultKey(ctx, style));
  const serial = serialSessions(options.maxPending ?? 10000);
  const active = new WeakSet();
  return async (ctx, next) => {
    if (active.has(ctx)) {
      throw new Error('Session middleware installed twice on one context');
    }
    active.add(ctx);
    try {
      const raw = await getKey(ctx);
      if (raw === undefined || (style === 'telegraf' && !raw)) {
        sessionProperty(ctx, property, undefined, style === 'grammy');
        return await next();
      }
      const key = `${options.prefix ?? ''}${raw}`;
      return await serial(key, async () => {
        let value = await storage.read(key);
        let initialized = false;
        if (value === undefined || (style === 'telegraf' && value === null)) {
          value = await initial?.(ctx);
          initialized = style === 'grammy' && value !== undefined;
        }
        const state = sessionProperty(
          ctx,
          property,
          globalThis.structuredClone(value),
          false
        );
        const save = async () => {
          if (initialized || state.touched()) {
            const value = state.value();
            if (value === undefined || value === null) {
              await storage.delete(key);
            } else {
              await storage.write(key, globalThis.structuredClone(value));
            }
          }
        };
        if (style === 'telegraf') {
          try {
            return await next();
          } finally {
            await save();
          }
        }
        const result = await next();
        await save();
        return result;
      });
    } finally {
      active.delete(ctx);
    }
  };
}

export function grammySession(options = {}) {
  return createSession(options, 'grammy');
}
export function telegrafSession(options = {}) {
  return createSession(options, 'telegraf');
}
export function session(options = {}) {
  return createSession(
    options,
    options.defaultSession || options.store ? 'telegraf' : 'grammy'
  );
}
