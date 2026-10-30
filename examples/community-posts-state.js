const phases = ['prompt', 'publishing', 'cleanup'];
export const usernamePattern = /^[a-zA-Z][a-zA-Z0-9_]{0,31}$/;
export const messageId = (id) =>
  Number.isInteger(id) && id > 0 && id <= 2147483647;
const timestamp = (value) => Number.isSafeInteger(value) && value >= 0;
const optionalUsername = (value) =>
  value === undefined ||
  (typeof value === 'string' && usernamePattern.test(value));

function retired(record, { retireBefore, promptBefore }) {
  return (
    retireBefore !== undefined &&
    (record.postAt ?? 0) <= retireBefore &&
    (record.liftAt ?? 0) <= retireBefore &&
    (!record.pending ||
      (record.pending.phase === 'prompt' &&
        record.pending.createdAt <= promptBefore))
  );
}

function validDelivery(pending) {
  return (
    (pending.phase === 'prompt' ||
      (typeof pending.text === 'string' && pending.text.length <= 4096)) &&
    (pending.phase !== 'cleanup' ||
      (pending.action === 'lift' && messageId(pending.newId)))
  );
}

function validPending(pending) {
  if (!pending) {
    return true;
  }
  return (
    ['post', 'lift'].includes(pending.action) &&
    phases.includes(pending.phase) &&
    typeof pending.chatId === 'string' &&
    /^-?[1-9]\d{0,19}$/.test(pending.chatId) &&
    typeof pending.username === 'string' &&
    usernamePattern.test(pending.username) &&
    timestamp(pending.createdAt) &&
    (pending.action !== 'lift' || messageId(pending.oldId)) &&
    validDelivery(pending)
  );
}

function validRecord(record) {
  return (
    record &&
    typeof record === 'object' &&
    !Array.isArray(record) &&
    ['postAt', 'liftAt'].every(
      (field) => record[field] === undefined || timestamp(record[field])
    ) &&
    (record.postId === undefined || messageId(record.postId)) &&
    optionalUsername(record.postUsername) &&
    validPending(record.pending)
  );
}

/** Bounded application journal over the library's atomic string store. */
export class CommunityState {
  constructor(store, { maxUsers = 10000, maxBytes = 4 * 1024 * 1024 } = {}) {
    if (!Number.isInteger(maxUsers) || maxUsers < 1 || maxUsers > 10000) {
      throw new RangeError('Community user limit must be between 1 and 10000');
    }
    if (
      !Number.isInteger(maxBytes) ||
      maxBytes < 256 ||
      maxBytes > 4 * 1024 * 1024
    ) {
      throw new RangeError('Invalid community journal byte limit');
    }
    this.store = store;
    this.maxUsers = maxUsers;
    this.maxBytes = maxBytes;
    this.users = {};
  }

  async load() {
    const raw = await this.store.load();
    if (typeof raw !== 'string' || Buffer.byteLength(raw) > this.maxBytes) {
      throw new RangeError('Invalid community journal size');
    }
    const state = raw ? JSON.parse(raw) : { version: 1, users: {} };
    if (
      state.version !== 1 ||
      !state.users ||
      typeof state.users !== 'object' ||
      Array.isArray(state.users) ||
      Object.keys(state.users).length > this.maxUsers
    ) {
      throw new TypeError('Invalid community journal');
    }
    for (const [id, record] of Object.entries(state.users)) {
      if (!/^[1-9]\d{0,19}$/.test(id) || !validRecord(record)) {
        throw new TypeError('Invalid community journal user');
      }
    }
    this.users = state.users;
  }

  async write(id, record, retirement = {}) {
    if (!/^[1-9]\d{0,19}$/.test(id) || !validRecord(record)) {
      throw new TypeError('Invalid community journal update');
    }
    const users = { ...this.users, [id]: globalThis.structuredClone(record) };
    if (Object.keys(users).length > this.maxUsers) {
      for (const key of Object.keys(users)) {
        if (key !== id && retired(users[key], retirement)) {
          delete users[key];
        }
      }
    }
    if (Object.keys(users).length > this.maxUsers) {
      throw new RangeError('Community user limit exceeded');
    }
    const raw = JSON.stringify({ version: 1, users });
    if (Buffer.byteLength(raw) > this.maxBytes) {
      throw new RangeError('Community journal byte limit exceeded');
    }
    await this.store.save(raw);
    this.users = users;
  }
}
