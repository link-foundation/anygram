import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { setImmediate as tick } from 'node:timers/promises';
import { Anygram, createAdapter, createClient, Session } from '../src/index.js';
import { FollowClient } from '../examples/follow-client.js';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

function gate() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function account(backend) {
  return new Anygram({ adapters: [createAdapter('mtproto', backend)] });
}

it('keeps standalone follow connections owned until both cleanup stages finish', async () => {
  const opening = gate();
  const closing = gate();
  const events = [];
  const client = account({
    connect: async () => {
      events.push('connect');
      await opening.promise;
    },
    disconnect: async () => {
      events.push('disconnect');
      await closing.promise;
    },
    destroy: async () => events.push('destroy'),
    call: async () => [{ _: 'user', id: 1n, first_name: 'Ada', self: true }],
  });
  const bridge = new FollowClient(client);
  const pending = bridge.connect();
  let connected = false;
  pending.then(() => {
    connected = true;
  });
  await tick();
  assert.equal(connected, false);
  opening.resolve();
  const view = await pending;
  assert.equal((await view.getMe()).firstName, 'Ada');
  assert.equal((await bridge.getMe()).className, 'User');
  await assert.rejects(bridge.connect(), /already owned/);
  await assert.rejects(
    bridge.withConnection(() => 1),
    /already owned/
  );
  await assert.rejects(
    client.withConnection(() => 1),
    /already owned/
  );
  let disconnected = false;
  const stop = bridge.disconnect().then(() => {
    disconnected = true;
  });
  await tick();
  assert.equal(disconnected, false);
  assert.deepEqual(events, ['connect', 'disconnect']);
  await assert.rejects(bridge.connect(), /already owned/);
  closing.resolve();
  await stop;
  assert.deepEqual(events, ['connect', 'disconnect', 'destroy']);
  assert.throws(() => bridge.getMe(), /not connected/);
  await bridge.disconnect();
  assert.equal(events.length, 3);
  assert.equal(await client.withConnection(() => 42), 42);
});

it('rejects manual disconnection inside callback-owned work without deadlocking', async () => {
  const events = [];
  const bridge = new FollowClient(
    account({
      connect: async () => {},
      disconnect: async () => events.push('disconnect'),
      destroy: async () => events.push('destroy'),
    })
  );
  assert.equal(typeof bridge.disconnect, 'function');
  const result = await bridge.withConnection(async () => {
    await assert.rejects(bridge.connect(), /already owned/);
    await assert.rejects(bridge.disconnect(), /callback/);
    return 42;
  });
  assert.equal(result, 42);
  assert.deepEqual(events, ['disconnect', 'destroy']);
});

it('awaits failed standalone login cleanup and retains the login and cleanup causes', async () => {
  const login = new Error('login failed');
  const close = new Error('close failed');
  const events = [];
  const bridge = new FollowClient(
    account({
      start: async () => {
        throw login;
      },
      disconnect: async () => {
        events.push('disconnect');
        throw close;
      },
      destroy: async () => events.push('destroy'),
    }),
    { scope: { start: {}, cleanupAttempts: 2, cleanupDelay: 0 } }
  );
  await assert.rejects(bridge.connect(), (error) => {
    assert(error instanceof globalThis.AggregateError);
    assert.equal(error.errors[0].cause, login);
    assert.equal(error.cause, error.errors[0]);
    assert.deepEqual(
      error.errors.slice(1).map((value) => value.cause),
      [close, close]
    );
    assert.deepEqual(events, ['disconnect', 'disconnect', 'destroy']);
    return true;
  });
  await bridge.disconnect();
  assert.throws(() => bridge.getMe(), /not connected/);
});

it('reports every exhausted standalone cleanup stage and releases ownership afterward', async () => {
  const failures = [];
  const client = account({
    connect: async () => {},
    disconnect: async () => {
      const error = new Error('disconnect TIMEOUT');
      failures.push(error);
      throw error;
    },
    destroy: async () => {
      const error = new Error('destroy TIMEOUT');
      failures.push(error);
      throw error;
    },
  });
  const bridge = new FollowClient(client, { scope: { cleanupDelay: 0 } });
  await bridge.connect();
  await assert.rejects(bridge.disconnect(), (error) => {
    assert(error instanceof globalThis.AggregateError);
    assert.equal(error.errors.length, 6);
    assert.deepEqual(
      error.errors.map((value) => value.cause),
      failures
    );
    return true;
  });
  assert.throws(() => bridge.getMe(), /not connected/);
  await bridge.disconnect();
  await bridge.connect();
  await assert.rejects(bridge.disconnect(), globalThis.AggregateError);
});

it('cancels held standalone work, waits for cleanup and exposes the original reason on disconnect', async () => {
  const controller = new globalThis.AbortController();
  const closing = gate();
  const entered = gate();
  const reason = new Error('stop standalone account');
  const events = [];
  const bridge = new FollowClient(
    account({
      connect: async () => {},
      disconnect: async () => {
        events.push('disconnect');
        entered.resolve();
        await closing.promise;
      },
      destroy: async () => events.push('destroy'),
    }),
    { scope: { signal: controller.signal } }
  );
  await bridge.connect();
  controller.abort(reason);
  await entered.promise;
  let finished = false;
  const stopped = assert
    .rejects(bridge.disconnect(), (error) => error === reason)
    .then(() => {
      finished = true;
    });
  await tick();
  assert.equal(finished, false);
  closing.resolve();
  await stopped;
  assert.deepEqual(events, ['disconnect', 'destroy']);
  await bridge.disconnect();
});

it('closes an opening connection before returning a usable client and awaits its cleanup', async () => {
  const opening = gate();
  const entered = gate();
  const events = [];
  const bridge = new FollowClient(
    account({
      connect: async () => {
        entered.resolve();
        await opening.promise;
      },
      disconnect: async () => events.push('disconnect'),
      destroy: async () => events.push('destroy'),
    })
  );
  const start = assert.rejects(bridge.connect(), /closed before/);
  await entered.promise;
  let stopped = false;
  const stop = bridge.disconnect().then(() => {
    stopped = true;
  });
  await tick();
  assert.equal(stopped, false);
  opening.resolve();
  await Promise.all([start, stop]);
  assert.deepEqual(events, ['disconnect', 'destroy']);
  assert.throws(() => bridge.getMe(), /not connected/);
});

it('rejects a pre-cancelled standalone scope without opening the backend', async () => {
  const controller = new globalThis.AbortController();
  const reason = new Error('already cancelled');
  controller.abort(reason);
  const bridge = new FollowClient(
    account({
      connect: async () => assert.fail('pre-cancelled connection opened'),
      disconnect: async () => assert.fail('unowned backend closed'),
    }),
    { scope: { signal: controller.signal } }
  );
  await assert.rejects(bridge.connect(), (error) => error === reason);
  await bridge.disconnect();
});

it('uses standalone follow helpers over encrypted native TCP and closes the transport', async () => {
  const peer = await secretRpcPeer((request) => {
    assert.equal(request._, 'users.getUsers');
    return [{ _: 'user', id: 1n, self: true, first_name: 'Ada' }];
  });
  const bridge = new FollowClient(account(peer.client));
  try {
    const view = await bridge.connect();
    assert.equal((await view.getMe()).firstName, 'Ada');
    assert.equal((await bridge.getMe()).className, 'User');
    await bridge.disconnect();
    assert.equal(peer.client.transport.closed, true);
  } finally {
    await peer.close();
  }
});

it('retains a background cancellation and exhausted cleanup until the caller disconnects', async () => {
  const controller = new globalThis.AbortController();
  const reason = new Error('cancel held connection');
  const failure = new Error('cannot close');
  const bridge = new FollowClient(
    account({
      connect: async () => {},
      disconnect: async () => {
        throw failure;
      },
      destroy: async () => {},
    }),
    { scope: { signal: controller.signal, cleanupAttempts: 1 } }
  );
  await bridge.connect();
  controller.abort(reason);
  // Give the background scope time to reject before attaching disconnect's waiter.
  await tick();
  await assert.rejects(bridge.disconnect(), (error) => {
    assert(error instanceof globalThis.AggregateError);
    assert.equal(error.cause, reason);
    assert.equal(error.errors[0], reason);
    assert.equal(error.errors[1].cause, failure);
    return true;
  });
});

for (const backend of ['gramjs', 'teleproto']) {
  it(`owns and closes an actual ${backend} client through standalone follow methods`, async () => {
    const client = await createClient({
      backend,
      libraries: [backend],
      native: false,
      apiId: 777,
      apiHash: 'a'.repeat(32),
      session: new Session({ dc: 2, authKey: Buffer.alloc(256, 42) }),
      clientOptions: {
        baseLogger: new (
          await import(backend === 'gramjs' ? 'telegram' : 'teleproto')
        ).Logger('none'),
      },
    });
    const real = client.backend();
    const events = [];
    real.connect = async () => events.push('connect');
    real.disconnect = async () => events.push('disconnect');
    real.destroy = async () => events.push('destroy');
    const { Api } = await import(
      backend === 'gramjs' ? 'telegram/tl/index.js' : 'teleproto/tl/index.js'
    );
    real.invoke = async (request) => {
      assert(request instanceof Api.users.GetUsers);
      assert(request.getBytes().length > 4);
      return [new Api.User({ id: 7n, firstName: 'Ada', self: true })];
    };
    const bridge = new FollowClient(client);
    await bridge.connect();
    try {
      assert.equal((await bridge.getMe()).firstName, 'Ada');
    } finally {
      await bridge.disconnect();
    }
    assert.deepEqual(events, ['connect', 'disconnect', 'destroy']);
  });
}
