import { TelegramError } from './errors.js';
import { normalize } from './operations.js';

function initialState(value = {}) {
  const { pts = 0, qts = 0, seq = 0, date = 0, channels = {} } = value;
  for (const number of [pts, qts, seq, date]) {
    if (!Number.isSafeInteger(number) || number < 0) {
      throw new RangeError('Invalid update sequence state');
    }
  }
  return {
    pts,
    qts,
    seq,
    date,
    channels: globalThis.structuredClone(channels),
  };
}

function channelId(update) {
  return update.channel_id ?? update.message?.peer_id?.channel_id;
}

const hasSequence = (update) =>
  update.pts !== undefined ||
  update.qts !== undefined ||
  update._ === 'updateChannelTooLong';

/** Serialized pts/qts/seq tracking with explicit, bounded difference recovery. */
export class UpdateManager {
  constructor({
    invoke,
    state,
    onUpdate = () => {},
    onState,
    onReset,
    resolveChannel,
    maxPages = 1000,
  } = {}) {
    if (typeof invoke !== 'function') {
      throw new TypeError('UpdateManager requires an invoke function');
    }
    if (!Number.isInteger(maxPages) || maxPages < 1) {
      throw new RangeError('Invalid recovery page limit');
    }
    Object.assign(this, {
      invoke,
      state: initialState(state),
      onUpdate,
      onState,
      onReset,
      resolveChannel,
      maxPages,
    });
    this.queue = Promise.resolve();
    this.recoveringChannels = new Set();
    this.persisted = globalThis.structuredClone(this.state);
  }
  async call(method, params) {
    return normalize(await this.invoke(method, params));
  }
  feed(value) {
    const task = this.queue.then(() => this.handle(normalize(value)));
    this.queue = task.catch(() => {});
    return task;
  }
  async save() {
    try {
      await this.onState?.(globalThis.structuredClone(this.state));
      this.persisted = globalThis.structuredClone(this.state);
    } catch (error) {
      this.state = globalThis.structuredClone(this.persisted);
      throw error;
    }
  }
  initialize() {
    const task = this.queue.then(() => this.initializeState());
    this.queue = task.catch(() => {});
    return task;
  }
  async initializeState() {
    if (!this.state.date) {
      Object.assign(
        this.state,
        initialState(await this.call('updates.getState'))
      );
      await this.save();
    } else {
      await this.recover();
    }
  }
  remember(chats = []) {
    for (const chat of chats) {
      if (chat._ !== 'channel' || chat.access_hash === undefined) {
        continue;
      }
      const previous = this.state.channels[String(chat.id)] ?? {};
      this.state.channels[String(chat.id)] = Object.assign(previous, {
        access_hash: chat.access_hash,
      });
    }
  }
  async handle(value) {
    if (value._ === 'updatesTooLong' || value._ === 'new_session_created') {
      return this.recover();
    }
    this.remember(value.chats);
    if (value._ === 'updateShort') {
      await this.apply(value.update);
      return;
    }
    if (value._?.startsWith('updateShort')) {
      await this.recover();
      return;
    }
    const updates = value.updates ?? [value];
    // Message-box sequences are independent of the envelope's seq.
    for (const update of updates) {
      if (hasSequence(update)) {
        await this.apply(update);
      }
    }
    await this.handleSequence(value, updates);
  }
  async handleSequence(value, updates) {
    const start = value.seq_start ?? value.seq ?? 0;
    if (start > this.state.seq + 1) {
      await this.recover();
    }
    if (start && start <= this.state.seq) {
      return;
    }
    if (start > this.state.seq + 1) {
      throw new TelegramError('Unresolved updates seq gap', {
        type: 'UPDATE_GAP',
      });
    }
    for (const update of updates) {
      if (!hasSequence(update)) {
        await this.onUpdate(update);
      }
    }
    if (value.seq) {
      this.state.seq = value.seq;
    }
    if (value.date) {
      this.state.date = Math.max(this.state.date, value.date);
    }
    await this.save();
  }
  async channel(id) {
    const key = String(id);
    let state = this.state.channels[key];
    if (state?.pts !== undefined && state.access_hash !== undefined) {
      return state;
    }
    const input =
      state?.access_hash !== undefined
        ? {
            _: 'inputChannel',
            channel_id: BigInt(id),
            access_hash: state.access_hash,
          }
        : await this.resolveChannel?.(BigInt(id));
    if (!input) {
      throw new TelegramError(
        'Channel access hash is unavailable for update recovery',
        { type: 'PEER_NOT_FOUND' }
      );
    }
    const full = await this.call('channels.getFullChannel', { channel: input });
    state = { pts: full.full_chat.pts, access_hash: input.access_hash };
    this.state.channels[key] = state;
    await this.onReset?.({
      scope: 'channel',
      channelId: BigInt(id),
      state: globalThis.structuredClone(state),
      reason: 'initialState',
    });
    await this.save();
    return state;
  }
  async apply(update) {
    if (update._ === 'updateChannelTooLong') {
      return this.recoverChannel(update.channel_id);
    }
    const id = channelId(update);
    const state = id === undefined ? this.state : await this.channel(id);
    const key = update.qts !== undefined ? 'qts' : 'pts';
    const target = update[key];
    if (target === undefined) {
      return this.onUpdate(update);
    }
    const count = key === 'qts' ? 1 : (update.pts_count ?? 0);
    if (state[key] + count < target) {
      if (id === undefined) {
        await this.recover();
      } else {
        await this.recoverChannel(id);
      }
    }
    if (state[key] + count > target) {
      return;
    }
    if (state[key] + count !== target) {
      throw new TelegramError('Unresolved message box gap', {
        type: 'UPDATE_GAP',
      });
    }
    await this.onUpdate(update);
    state[key] = target;
    await this.save();
    if (key === 'qts') {
      await this.call('messages.receivedQueue', { max_qts: target });
    }
  }
  async differenceEvents(result, channel) {
    this.remember(result.chats);
    for (const message of result.new_messages ?? []) {
      await this.onUpdate({
        _: channel ? 'updateNewChannelMessage' : 'updateNewMessage',
        message,
        recovered: true,
      });
    }
    for (const message of result.new_encrypted_messages ?? []) {
      await this.onUpdate({
        _: 'updateNewEncryptedMessage',
        message,
        recovered: true,
      });
    }
    for (const update of result.other_updates ?? []) {
      if (update._ === 'updateChannelTooLong') {
        await this.recoverChannel(update.channel_id);
      } else {
        await this.onUpdate(update);
      }
    }
  }
  async recover() {
    for (let page = 0; page < this.maxPages; page++) {
      const { pts, qts, date } = this.state;
      const result = await this.call('updates.getDifference', {
        pts,
        qts,
        date,
        pts_total_limit: 10000,
      });
      if (result._ === 'updates.differenceTooLong') {
        await this.onReset?.({
          scope: 'common',
          reason: 'differenceTooLong',
          pts: result.pts,
        });
        Object.assign(
          this.state,
          initialState({
            ...(await this.call('updates.getState')),
            channels: this.state.channels,
          })
        );
        await this.save();
        return;
      }
      if (result._ === 'updates.differenceEmpty') {
        this.state.date = result.date;
        this.state.seq = result.seq;
        await this.save();
        return;
      }
      if (
        !['updates.difference', 'updates.differenceSlice'].includes(result._)
      ) {
        throw new TelegramError('Invalid updates difference response');
      }
      await this.differenceEvents(result);
      const next = result.state ?? result.intermediate_state;
      Object.assign(
        this.state,
        initialState({ ...next, channels: this.state.channels })
      );
      await this.save();
      if (this.state.qts) {
        await this.call('messages.receivedQueue', { max_qts: this.state.qts });
      }
      if (result._ === 'updates.difference') {
        return;
      }
      if (
        this.state.pts === pts &&
        this.state.qts === qts &&
        this.state.date === date
      ) {
        throw new TelegramError('Updates difference made no progress');
      }
    }
    throw new TelegramError('Updates difference page limit exceeded');
  }
  async recoverChannel(id) {
    const key = String(id);
    if (
      this.recoveringChannels.has(key) ||
      this.recoveringChannels.size >= 32
    ) {
      throw new TelegramError(
        'Cyclic channel recovery or recovery depth exceeded'
      );
    }
    this.recoveringChannels.add(key);
    try {
      return await this.channelDifference(id);
    } finally {
      this.recoveringChannels.delete(key);
    }
  }
  async channelDifference(id) {
    const state = await this.channel(id);
    for (let page = 0; page < this.maxPages; page++) {
      const before = state.pts;
      const result = await this.call('updates.getChannelDifference', {
        channel: {
          _: 'inputChannel',
          channel_id: BigInt(id),
          access_hash: state.access_hash,
        },
        filter: { _: 'channelMessagesFilterEmpty' },
        pts: before,
        limit: 100,
      });
      if (result._ === 'updates.channelDifferenceTooLong') {
        await this.onReset?.({
          scope: 'channel',
          channelId: BigInt(id),
          reason: 'differenceTooLong',
          result,
        });
        state.pts = result.dialog.pts;
      } else if (result._ === 'updates.channelDifference') {
        await this.differenceEvents(result, true);
        state.pts = result.pts;
      } else if (result._ === 'updates.channelDifferenceEmpty') {
        state.pts = result.pts;
      } else {
        throw new TelegramError('Invalid channel difference response');
      }
      await this.save();
      if (result.final) {
        return result.timeout;
      }
      if (state.pts === before) {
        throw new TelegramError('Channel difference made no progress');
      }
    }
    throw new TelegramError('Channel difference page limit exceeded');
  }
}
