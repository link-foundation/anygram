import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import {
  Anygram,
  createAdapter,
  createClient,
  UnsupportedError,
} from '../src/index.js';
import { Logger } from 'telegram';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

function lifecycleClient(backend, options = {}) {
  return new Anygram({
    ...options,
    adapters: [createAdapter('account', backend, { kind: 'mtproto' })],
  });
}

it('awaits connection, work, disconnect and destruction in order and returns the work result', async () => {
  const events = [];
  const backend = {
    async connect(options) {
      await Promise.resolve();
      assert.equal(options.timeout, 321);
      events.push('connect');
    },
    async disconnect() {
      await Promise.resolve();
      events.push('disconnect');
    },
    async destroy() {
      await Promise.resolve();
      events.push('destroy');
    },
  };
  const client = lifecycleClient(backend);
  const result = await client.withConnection(
    async (connected) => {
      assert.equal(connected.selected, 'account');
      assert.equal(connected.backend(), client.backend());
      events.push('work');
      await Promise.resolve();
      return 42;
    },
    { timeout: 321 }
  );
  assert.equal(result, 42);
  assert.deepEqual(events, ['connect', 'work', 'disconnect', 'destroy']);
});

it('runs optional login once before work and owns login options across asynchronous setup', async () => {
  const calls = [];
  const backend = {
    start: async (options) => {
      await Promise.resolve();
      calls.push(options.phoneNumber);
    },
    connect: () => assert.fail('explicit login used connect instead'),
    disconnect: async () => calls.push('disconnect'),
    destroy: async () => calls.push('destroy'),
  };
  const start = { phoneNumber: '+15550000000' };
  const client = lifecycleClient(backend);
  const result = client.withConnection(() => calls.push('work'), { start });
  start.phoneNumber = '+15559999999';
  await result;
  assert.deepEqual(calls, ['+15550000000', 'work', 'disconnect', 'destroy']);
});

it('retries each cleanup stage at most three times and always attempts destruction', async () => {
  const calls = [];
  const failures = [];
  const backend = {
    connect: async () => {},
    disconnect: async () => {
      calls.push('disconnect');
      const error = new Error(`TIMEOUT ${failures.length}`);
      failures.push(error);
      throw error;
    },
    destroy: async () => {
      calls.push('destroy');
      const error = new Error(`connection ${failures.length}`);
      failures.push(error);
      throw error;
    },
  };
  await assert.rejects(
    lifecycleClient(backend).withConnection(() => 1, {
      cleanupDelay: 0,
    }),
    (error) => {
      assert.ok(error instanceof globalThis.AggregateError);
      assert.deepEqual(
        error.errors.map((failure) => failure.cause),
        failures
      );
      return true;
    }
  );
  assert.deepEqual(calls, [
    'disconnect',
    'disconnect',
    'disconnect',
    'destroy',
    'destroy',
    'destroy',
  ]);
});

it('forwards scope request options to login without leaking cleanup controls', async () => {
  const controller = new globalThis.AbortController();
  const client = lifecycleClient({
    start: async (options) => {
      assert.equal(options.timeout, 321);
      assert.equal(options.dc, 4);
      assert.equal(options.signal, controller.signal);
      assert.equal(options.phoneNumber, '+15550000000');
      assert.equal(options.cleanupAttempts, undefined);
      assert.equal(options.cleanupDelay, undefined);
    },
    disconnect: async () => {},
  });
  await client.withConnection(() => 1, {
    start: { phoneNumber: '+15550000000' },
    timeout: 321,
    dc: 4,
    signal: controller.signal,
    cleanupAttempts: 1,
    cleanupDelay: 0,
  });
});

it('recovers transient cleanup failures without replaying login or work', async () => {
  const calls = { connect: 0, work: 0, disconnect: 0, destroy: 0 };
  const client = lifecycleClient({
    connect: async () => calls.connect++,
    disconnect: async () => {
      if (++calls.disconnect < 3) {
        throw new Error('TIMEOUT');
      }
    },
    destroy: async () => {
      if (++calls.destroy < 2) {
        throw new Error('connection reset');
      }
    },
  });
  assert.equal(
    await client.withConnection(() => ++calls.work, { cleanupDelay: 0 }),
    1
  );
  assert.deepEqual(calls, { connect: 1, work: 1, disconnect: 3, destroy: 2 });
});

it('retains the original work failure with every cleanup failure instead of replacing it', async () => {
  const primary = new Error('work failed');
  const failed = [new Error('disconnect failed'), new Error('destroy failed')];
  const client = lifecycleClient({
    connect: async () => {},
    disconnect: async () => {
      throw failed[0];
    },
    destroy: async () => {
      throw failed[1];
    },
  });
  await assert.rejects(
    client.withConnection(
      () => {
        throw primary;
      },
      {
        cleanupAttempts: 1,
        cleanupDelay: 0,
      }
    ),
    (error) => {
      assert.ok(error instanceof globalThis.AggregateError);
      assert.equal(error.cause, primary);
      assert.equal(error.errors[0], primary);
      assert.deepEqual(
        error.errors.slice(1).map((failure) => failure.cause),
        failed
      );
      return true;
    }
  );
});

it('cleans a partially opened connection and preserves its original connection error', async () => {
  const primary = new Error('authentication failed');
  const events = [];
  const client = lifecycleClient({
    connect: async () => {
      throw primary;
    },
    disconnect: async () => events.push('disconnect'),
    destroy: async () => events.push('destroy'),
  });
  await assert.rejects(
    client.withConnection(() => assert.fail('work before connection')),
    (error) => {
      assert.equal(error.cause, primary);
      return true;
    }
  );
  assert.deepEqual(events, ['disconnect', 'destroy']);
});

it('reports an exhausted destroy stage even if disconnect succeeded', async () => {
  let destroys = 0;
  const client = lifecycleClient({
    connect: async () => {},
    disconnect: async () => {},
    destroy: async () => {
      destroys++;
      throw new Error('destroy failed');
    },
  });
  await assert.rejects(
    client.withConnection(() => 1, { cleanupDelay: 0 }),
    (error) => {
      assert.ok(error instanceof globalThis.AggregateError);
      assert.equal(error.errors.length, 3);
      return true;
    }
  );
  assert.equal(destroys, 3);
});

it('continues cleanup after cancellation without invoking the application task', async () => {
  const controller = new globalThis.AbortController();
  const primary = new Error('cancelled during connection');
  const events = [];
  const client = lifecycleClient({
    connect: async () => controller.abort(primary),
    disconnect: async () => events.push('disconnect'),
    destroy: async () => events.push('destroy'),
  });
  await assert.rejects(
    client.withConnection(() => assert.fail('cancelled task ran'), {
      signal: controller.signal,
    }),
    (error) => error === primary
  );
  assert.deepEqual(events, ['disconnect', 'destroy']);
});

it('validates lifecycle controls and pre-cancellation before opening any connection', async () => {
  const client = lifecycleClient({
    connect: () => assert.fail('invalid scope opened connection'),
    disconnect: () => assert.fail('invalid scope attempted cleanup'),
  });
  for (const options of [
    { cleanupAttempts: 0 },
    { cleanupAttempts: 4 },
    { cleanupAttempts: 1.5 },
    { cleanupDelay: -1 },
    { cleanupDelay: Infinity },
    { cleanupDelay: 1001 },
    { start: null },
    { start: false },
  ]) {
    await assert.rejects(
      async () => client.withConnection(() => 1, options),
      TypeError
    );
  }
  await assert.rejects(async () => client.withConnection(undefined), TypeError);
  const primary = new Error('cancelled before connection');
  await assert.rejects(
    async () =>
      client.withConnection(() => 1, {
        signal: globalThis.AbortSignal.abort(primary),
      }),
    (error) => error === primary
  );
});

it('rejects a scope that cannot be closed before creating resources', async () => {
  const client = lifecycleClient({
    connect: () => assert.fail('unclosable scope connected'),
  });
  await assert.rejects(
    async () => client.withConnection(() => 1),
    UnsupportedError
  );
});

it('owns the selected backend across scopes and rejects overlapping ownership', async () => {
  let finish;
  let entered;
  const ready = new Promise((resolve) => {
    entered = resolve;
  });
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  const events = [];
  const first = createAdapter('first', {
    connect: () => assert.fail('wrong backend'),
  });
  const backend = {
    connect: async () => events.push('connect'),
    disconnect: async () => events.push('disconnect'),
  };
  const second = createAdapter('second', backend);
  const client = new Anygram({ adapters: [first, second], backend: 'second' });
  const pending = client.withConnection(async (scoped) => {
    assert.equal(scoped.backend(), client.backend());
    entered();
    await gate;
    return 'done';
  });
  try {
    await ready;
    await assert.rejects(
      client.withBackend('second').withConnection(() => 1),
      /already owned/
    );
  } finally {
    finish();
  }
  assert.equal(await pending, 'done');
  assert.deepEqual(events, ['connect', 'disconnect']);
  await client.withConnection(() => 1);
  assert.equal(events.length, 4);
});

it('preserves even an undefined thrown value and releases ownership after a failed task', async () => {
  let disconnects = 0;
  const client = lifecycleClient({
    connect: async () => {},
    disconnect: async () => {
      disconnects++;
    },
  });
  let caught = false;
  try {
    await client.withConnection(() => {
      throw undefined;
    });
  } catch (error) {
    caught = true;
    assert.equal(error, undefined);
  }
  assert.equal(caught, true);
  assert.equal(await client.withConnection(() => 8), 8);
  assert.equal(disconnects, 2);
});

it('keeps failing diagnostic callbacks from interrupting cleanup and emits metadata only', async () => {
  const events = [];
  let disconnects = 0;
  let destroyed = false;
  const client = lifecycleClient(
    {
      connect: async () => {},
      disconnect: async () => {
        if (++disconnects === 1) {
          throw new Error('private connection detail');
        }
      },
      destroy: async () => {
        destroyed = true;
      },
    },
    {
      debug(event) {
        events.push(event);
        if (event.event === 'cleanup.retry') {
          throw new Error('diagnostic failed');
        }
      },
    }
  );
  assert.equal(await client.withConnection(() => 8, { cleanupDelay: 0 }), 8);
  assert.equal(disconnects, 2);
  assert.equal(destroyed, true);
  assert.equal(JSON.stringify(events).includes('private'), false);
  assert.ok(events.some((event) => event.event === 'cleanup.retry'));
});

it('can close a backend that exposes only destruction and awaits its asynchronous completion', async () => {
  let finish;
  let destroying;
  const gate = new Promise((resolve) => {
    finish = resolve;
  });
  const ready = new Promise((resolve) => {
    destroying = resolve;
  });
  const client = lifecycleClient({
    connect: async () => {},
    destroy: async () => {
      destroying();
      await gate;
    },
  });
  let settled = false;
  const pending = client
    .withConnection(() => 9)
    .then((value) => {
      settled = true;
      return value;
    });
  await ready;
  assert.equal(settled, false);
  finish();
  assert.equal(await pending, 9);
});

for (const library of ['gramjs', 'teleproto']) {
  it(`awaits actual ${library} backend destruction after scoped work`, async () => {
    const client = await createClient({
      apiId: 777,
      apiHash: 'example',
      libraries: [library],
      native: false,
      clientOptions: { baseLogger: new Logger('none') },
    });
    const backend = client.backend();
    backend.connect = async () => {};
    assert.equal(await client.withConnection(() => 7), 7);
    assert.equal(backend._destroyed, true);
    assert.deepEqual(backend._eventBuilders, []);
  });
}

it('closes a native encrypted TCP connection before returning scoped RPC results', async () => {
  const peer = await secretRpcPeer((request) => {
    assert.equal(request._, 'help.getNearestDc');
    return { _: 'nearestDc', country: 'US', this_dc: 2, nearest_dc: 2 };
  });
  try {
    const client = lifecycleClient(peer.client);
    const result = await client.withConnection((scoped) =>
      scoped.invoke('help.getNearestDc')
    );
    assert.equal(result.nearest_dc, 2);
    assert.equal(peer.client.transport.closed, true);
    assert.equal(peer.client.transport.socket.destroyed, true);
  } finally {
    await peer.close();
  }
});
