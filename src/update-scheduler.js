/** One polling-loop clock, with no timer or worker allocated per membership. */
export class UpdateScheduler {
  constructor(manager, clock = Date.now) {
    this.manager = manager;
    this.clock = clock;
    this.watched = new Map();
    this.touch();
  }
  touch() {
    this.lastPush = this.clock();
  }
  watch(id) {
    const key = channelKey(id);
    if (!this.watched.has(key)) {
      // https://core.telegram.org/api/updates#getting-updates-for-channels
      if (this.watched.size >= 10) {
        throw new RangeError('Watched channel limit exceeded (10)');
      }
      this.watched.set(key, { next: this.clock() });
    }
  }
  unwatch(id) {
    this.watched.delete(channelKey(id));
  }
  async tick() {
    const now = this.clock();
    if (now - this.lastPush >= 15 * 60 * 1000) {
      await this.manager.recover();
      this.touch();
    }
    for (const [id, schedule] of [...this.watched]) {
      if (schedule.next > now) {
        continue;
      }
      const timeout = (await this.manager.recoverChannel(BigInt(id))) ?? 30;
      if (!Number.isFinite(timeout) || timeout < 0) {
        throw new RangeError('Invalid channel difference timeout');
      }
      schedule.next = this.clock() + Math.max(1, timeout) * 1000;
    }
  }
}

function channelKey(id) {
  try {
    if (typeof id === 'number' && !Number.isSafeInteger(id)) {
      throw new RangeError();
    }
    const value = BigInt(id);
    if (value <= 0n || value >= 1n << 63n) {
      throw new RangeError();
    }
    return String(value);
  } catch {
    throw new RangeError('Invalid watched channel ID');
  }
}
