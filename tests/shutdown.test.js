import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Mtproto } from '../src/mtproto.js';

function controlledTransport() {
  let release;
  const completed = new Promise((resolve) => {
    release = resolve;
  });
  return {
    release,
    request: () => assert.fail('Shutdown must not send RPCs'),
    close: () => completed,
  };
}

it('awaits asynchronous transport cleanup before disconnect resolves', async () => {
  const transport = controlledTransport();
  const client = new Mtproto({ transport });
  client.initialized = true;
  let finished = false;
  const closing = client.disconnect().then(() => {
    finished = true;
  });
  try {
    // Drain promise continuations without depending on elapsed milliseconds.
    for (let step = 0; step < 10; step++) {
      await Promise.resolve();
    }
    assert.equal(finished, false);
    assert.equal(client.initialized, false);
  } finally {
    transport.release();
    await closing;
  }
  assert.equal(finished, true);
});

it('closes every DC even when one asynchronous cleanup rejects', async () => {
  const events = [];
  const failure = new Error('first transport cleanup failed');
  const client = new Mtproto({
    transport: {
      request: () => assert.fail(),
      close: async () => {
        events.push(2);
        throw failure;
      },
    },
    transportFactory: (dc) => ({
      request: () => assert.fail(),
      close: async () => {
        await Promise.resolve();
        events.push(dc);
      },
    }),
  });
  const secondary = await client.datacenters.client(4);
  secondary.initialized = true;
  await assert.rejects(client.disconnect(), (error) => error === failure);
  assert.deepEqual(events.sort(), [2, 4]);
  assert.equal(secondary.initialized, false);
});

it('attempts all synchronous DC closures and retains multiple failures', async () => {
  const events = [];
  const failures = [new Error('DC 2 failed'), new Error('DC 4 failed')];
  const transport = (dc) => ({
    request: () => assert.fail(),
    close: () => {
      events.push(dc);
      throw failures[dc === 2 ? 0 : 1];
    },
  });
  const client = new Mtproto({
    transport: transport(2),
    transportFactory: transport,
  });
  await client.datacenters.client(4);
  await assert.rejects(
    client.disconnect(),
    (error) =>
      error instanceof globalThis.AggregateError &&
      error.errors.length === 2 &&
      failures.every((failure) => error.errors.includes(failure))
  );
  assert.deepEqual(events.sort(), [2, 4]);
});
