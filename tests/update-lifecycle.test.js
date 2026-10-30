import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Mtproto } from '../src/mtproto.js';

function deferred() {
  let resolve;
  const promise = new Promise((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function within(promise) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((resolve, reject) => {
        timer = globalThis.setTimeout(
          () => reject(new Error('Update lifecycle test exceeded 2 seconds')),
          2000
        );
      }),
    ]);
  } finally {
    globalThis.clearTimeout(timer);
  }
}

const state = { pts: 1, qts: 0, seq: 0, date: 1 };
const difference = { _: 'updates.differenceEmpty', date: 1, seq: 0 };
const update = (id) => ({
  _: 'updateShort',
  update: { _: 'updateNewMessage', message: { id }, pts: id, pts_count: 1 },
});

function clientForUpdates() {
  const client = new Mtproto({ authKey: Buffer.alloc(256, 42) });
  client.call = async () => difference;
  return client;
}

it('rejects invalid native polling counts before reading storage or invoking RPCs', async () => {
  const client = clientForUpdates();
  let touched = 0;
  const load = async () => {
    touched++;
    return null;
  };
  const save = async () => {
    touched++;
  };
  client.call = async () => {
    touched++;
    return state;
  };
  for (const maxPolls of [-1, 0.5, NaN, '1', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(
      client.runUpdates({ maxPolls, stateStore: { load, save } }),
      /polling/i
    );
  }
  assert.equal(touched, 0);
  assert.equal(client.updatesController, undefined);
});

it('does no initialization work when the native update loop is already cancelled', async () => {
  const client = clientForUpdates();
  let touched = 0;
  client.call = async () => {
    touched++;
    return state;
  };
  await client.runUpdates({
    maxPolls: 0,
    signal: globalThis.AbortSignal.abort(),
    stateStore: {
      load: async () => {
        touched++;
        return null;
      },
      save: async () => {
        touched++;
      },
    },
  });
  assert.equal(touched, 0);
  assert.equal(client.updateManager, undefined);
});

it('stops cleanly during initial recovery and restores the previous update handler', async () => {
  const client = clientForUpdates();
  const entered = deferred();
  const previous = () => {};
  client.onUpdate = previous;
  client.call = (method, params, { signal }) => {
    entered.resolve();
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      });
    });
  };
  const running = client.runUpdates({ state, maxPolls: 1 });
  await within(entered.promise);
  client.stopUpdates();
  await within(running);
  assert.equal(client.onUpdate, previous);
  assert.equal(client.updatesController, undefined);
  assert.equal(client.updateManager, undefined);
  client.call = async () => difference;
  await client.runUpdates({ state, maxPolls: 0 });
});

it('stops cleanly during scheduled channel recovery before starting another poll', async () => {
  const client = clientForUpdates();
  const entered = deferred();
  let polls = 0;
  client.pollUpdates = async () => {
    polls++;
  };
  client.call = async (method, params, { signal }) => {
    if (method === 'updates.getDifference') {
      return difference;
    }
    assert.equal(method, 'updates.getChannelDifference');
    entered.resolve();
    return new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason), {
        once: true,
      });
    });
  };
  const running = client.runUpdates({
    state: { ...state, channels: { 42: { pts: 1, access_hash: 7n } } },
    maxPolls: 1,
    watchedChannels: [42n],
  });
  await within(entered.promise);
  client.stopUpdates();
  await within(running);
  assert.equal(polls, 0);
  assert.equal(client.updateManager, undefined);
});

it('drains handlers and saved cursors when cancellation interrupts polling', async () => {
  const client = clientForUpdates();
  const entered = deferred();
  const release = deferred();
  const saved = [];
  let finished = false;
  client.pollUpdates = async ({ signal }) => {
    client.pendingUpdates.push(update(2));
    client.dispatchUpdates();
    await entered.promise;
    client.stopUpdates();
    throw signal.reason;
  };
  const running = client
    .runUpdates({
      state,
      maxPolls: 1,
      onUpdate: async () => {
        entered.resolve();
        await release.promise;
      },
      onState: (value) => saved.push(value.pts),
    })
    .finally(() => {
      finished = true;
    });
  let completedBeforeHandler;
  try {
    await within(entered.promise);
    for (let step = 0; step < 30; step++) {
      await Promise.resolve();
    }
    completedBeforeHandler = finished;
  } finally {
    release.resolve();
    await within(running);
  }
  assert.equal(completedBeforeHandler, false);
  assert.equal(saved.at(-1), 2);
});

it('preserves handler and persistence failures while stopping the update loop', async () => {
  for (const phase of ['handler', 'save']) {
    const client = clientForUpdates();
    const failure = new Error(`${phase} failed during shutdown`);
    client.pollUpdates = async ({ signal }) => {
      client.pendingUpdates.push(update(2));
      client.dispatchUpdates();
      client.stopUpdates();
      throw signal.reason;
    };
    await assert.rejects(
      within(
        client.runUpdates({
          state,
          maxPolls: 1,
          onUpdate: () => {
            if (phase === 'handler') {
              throw failure;
            }
          },
          onState: (value) => {
            if (phase === 'save' && value.pts === 2) {
              throw failure;
            }
          },
        })
      ),
      (error) => error === failure
    );
    assert.equal(client.updatesController, undefined);
  }
});

it('does not suppress an unrelated polling failure when the update loop is cancelled', async () => {
  const client = clientForUpdates();
  const failure = new Error('connection failed');
  client.pollUpdates = async () => {
    client.stopUpdates();
    throw failure;
  };
  await assert.rejects(
    client.runUpdates({ state, maxPolls: 1 }),
    (error) => error === failure
  );
});

it('drains updates appended by an accepted handler before restoring dispatch', async () => {
  const client = clientForUpdates();
  const entered = deferred();
  const release = deferred();
  const seen = [];
  client.pollUpdates = async ({ signal }) => {
    client.pendingUpdates.push(update(2));
    client.dispatchUpdates();
    client.stopUpdates();
    throw signal.reason;
  };
  const running = client.runUpdates({
    state,
    maxPolls: 1,
    onUpdate: async (value) => {
      seen.push(value.message.id);
      if (value.message.id === 2) {
        await release.promise;
        client.pendingUpdates.push(update(3));
        client.dispatchUpdates();
      } else {
        entered.resolve();
      }
    },
  });
  release.resolve();
  await within(running);
  await within(entered.promise);
  assert.deepEqual(seen, [2, 3]);
});

it('retains independent polling and handler failures instead of hiding either one', async () => {
  const client = clientForUpdates();
  const failures = [new Error('poll failed'), new Error('handler failed')];
  client.pollUpdates = async () => {
    client.pendingUpdates.push(update(2));
    client.dispatchUpdates();
    throw failures[0];
  };
  await assert.rejects(
    within(
      client.runUpdates({
        state,
        maxPolls: 1,
        onUpdate: () => {
          throw failures[1];
        },
      })
    ),
    (error) =>
      error instanceof globalThis.AggregateError &&
      error.errors.length === 2 &&
      failures.every((failure) => error.errors.includes(failure))
  );
});

it('bounds new-session recovery notifications in the same pending update queue', () => {
  const client = clientForUpdates();
  const notification = { _: 'new_session_created', server_salt: 1n };
  for (let count = 0; count < 1000; count++) {
    client.processService(notification, {});
  }
  assert.throws(
    () => client.processService(notification, {}),
    /pending update limit/i
  );
  assert.equal(client.pendingUpdates.length, 1000);
});

it('retains distinct queued handler failures while stopping', async () => {
  const client = clientForUpdates();
  const failures = [new Error('first handler'), new Error('second handler')];
  client.pollUpdates = async ({ signal }) => {
    for (const id of [0, 1]) {
      client.pendingUpdates.push({
        _: 'updateShort',
        update: { _: 'updateUserStatus', user_id: id },
      });
    }
    client.dispatchUpdates();
    client.stopUpdates();
    throw signal.reason;
  };
  await assert.rejects(
    within(
      client.runUpdates({
        state,
        maxPolls: 1,
        onUpdate: (value) => {
          throw failures[value.user_id];
        },
      })
    ),
    (error) =>
      error instanceof globalThis.AggregateError &&
      error.errors.length === 2 &&
      failures.every((failure) => error.errors.includes(failure))
  );
});

it('bounds retained handler failures and reports overflow explicitly', async () => {
  const client = clientForUpdates();
  const failure = new Error('passive handler failed');
  client.onUpdate = () => {
    throw failure;
  };
  for (let count = 0; count < 1002; count++) {
    client.pendingUpdates.push({ _: 'updateUserStatus', user_id: count });
    client.dispatchUpdates();
  }
  await assert.rejects(
    within(client.drainUpdates()),
    (error) =>
      error instanceof globalThis.AggregateError &&
      error.errors.length === 1001 &&
      error.errors[0] === failure &&
      /handler failure limit/i.test(error.errors.at(-1).message)
  );
  await client.drainUpdates();
});

it('discards only its own recovery cancellation while preserving a preceding handler failure', async () => {
  for (const failHandler of [false, true]) {
    const client = clientForUpdates();
    const failure = new Error('accepted handler failed');
    client.call = async (method, params, { signal }) => {
      signal.throwIfAborted();
      return difference;
    };
    client.pollUpdates = async ({ signal }) => {
      client.pendingUpdates.push(update(2), update(4), update(5));
      client.dispatchUpdates();
      client.stopUpdates();
      throw signal.reason;
    };
    const running = within(
      client.runUpdates({
        state,
        maxPolls: 1,
        onUpdate: () => {
          if (failHandler) {
            throw failure;
          }
        },
      })
    );
    if (failHandler) {
      await assert.rejects(running, (error) => error === failure);
    } else {
      assert.equal((await running).pts, 2);
    }
    assert.equal(client.updatesController, undefined);
  }
});
