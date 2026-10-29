import { TelegramError, throwFailures } from './errors.js';

/** Follow explicit server migrations; ambiguous request failures are never replayed. */
export class DatacenterPool {
  constructor(home, create, onHomeChange) {
    Object.assign(this, { home, create, onHomeChange });
    this.clients = new Map([[home.dc, home]]);
    this.authorized = new Set();
  }
  async client(dc) {
    if (!Number.isInteger(dc) || dc < 1 || dc > 5) {
      throw new RangeError('Unknown Telegram data center');
    }
    if (!this.clients.has(dc)) {
      this.clients.set(dc, await this.create(dc));
    }
    return this.clients.get(dc);
  }
  async transfer(target, request, options) {
    if (this.authorized.has(target.dc)) {
      return;
    }
    try {
      const authorization = await this.home.rpc(
        { _: 'auth.exportAuthorization', dc_id: target.dc },
        options
      );
      await target.rpc(
        {
          _: 'auth.importAuthorization',
          id: authorization.id,
          bytes: authorization.bytes,
        },
        options
      );
      this.authorized.add(target.dc);
    } catch (error) {
      if (error.code !== 401 || !request._.startsWith('auth.')) {
        throw error;
      }
    }
  }
  async setHome(current, options) {
    await current.connect?.(options);
    this.home = current;
    await this.onHomeChange?.(current);
  }
  async select(request, options) {
    const current =
      options.dc === undefined ? this.home : await this.client(options.dc);
    if (current !== this.home && !request._.startsWith('auth.')) {
      await this.transfer(current, request, options);
    }
    if (options.migrate) {
      await this.setHome(current, options);
    }
    return current;
  }
  async call(request, options = {}) {
    let current = await this.select(request, options);
    const visited = new Set([current.dc]);
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await current.rpc(request, options);
      } catch (error) {
        const migration = /^(PHONE|NETWORK|USER|FILE)_MIGRATE_([1-5])$/.exec(
          error.type ?? error.message
        );
        if (error.code !== 303 || !migration) {
          throw error;
        }
        const dc = Number(migration[2]);
        if (visited.has(dc)) {
          throw new TelegramError('Telegram data center migration cycle', {
            type: 'DC_MIGRATION_CYCLE',
          });
        }
        visited.add(dc);
        current = await this.client(dc);
        if (
          !['PHONE', 'NETWORK'].includes(migration[1]) ||
          !request._.startsWith('auth.')
        ) {
          await this.transfer(current, request, options);
        }
        if (migration[1] !== 'FILE') {
          await this.setHome(current, options);
        }
      }
    }
    throw new TelegramError('Telegram data center migration limit exceeded');
  }
  async close() {
    const results = await Promise.allSettled(
      [...this.clients.values()].map((client) =>
        Promise.resolve().then(() => client.closeTransport())
      )
    );
    const failures = results
      .filter((result) => result.status === 'rejected')
      .map((result) => result.reason);
    throwFailures(failures, 'Telegram DC cleanup failed');
  }
}
