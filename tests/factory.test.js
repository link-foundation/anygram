import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createClient } from '../src/index.js';
import { Logger, sessions } from 'telegram';
import { randomBytes } from 'node:crypto';
import { Session } from '../src/session.js';
it('creates a native Bot API client without loading Telegram dependencies', async () => {
  const client = await createClient({
    token: '123:test',
    libraries: [],
    fetch: async () =>
      new Response(
        JSON.stringify({ ok: true, result: { id: 123, is_bot: true } })
      ),
  });
  assert.equal((await client.getMe()).id, 123);
  assert.equal(client.capabilities()[0].name, 'native');
});
it('creates a disconnected independent MTProto client when libraries are disabled', async () => {
  const client = await createClient({
    apiId: 12345,
    apiHash: 'example',
    libraries: [],
    transport: {
      request: async () => assert.fail('Factory connected eagerly'),
    },
  });
  assert.equal(client.backend().apiId, 12345);
  assert.equal(client.capabilities()[0].protocol, 'mtproto');
});
it('does not pretend that all backends can be disabled without a transport', async () => {
  await assert.rejects(
    createClient({ native: false, libraries: [] }),
    /unavailable/
  );
});
it('constructs an actual GramJS client with an empty in-memory session', async () => {
  const client = await createClient({
    native: false,
    libraries: ['gramjs'],
    apiId: 12345,
    apiHash: 'example',
    clientOptions: { baseLogger: new Logger('none') },
  });
  assert.ok(client.backend().session instanceof sessions.StringSession);
  assert.equal(client.backend().disconnected, true);
});
it('loads a portable session into GramJS and persists it after successful login', async () => {
  const original = new Session({ dc: 4, authKey: randomBytes(256) });
  const saved = [];
  const client = await createClient({
    native: false,
    libraries: ['gramjs'],
    apiId: 12345,
    apiHash: 'example',
    clientOptions: { baseLogger: new Logger('none') },
    sessionStore: {
      load: async () => original.save(),
      save: async (value) => saved.push(value),
    },
  });
  const backend = client.backend();
  assert.equal(backend.session.dcId, 4);
  assert.deepEqual(
    backend.session.authKey.getKey(),
    original.options().authKey
  );
  backend.start = async () => ({ id: 7n });
  assert.deepEqual(await client.start({}), { id: 7n });
  assert.equal(saved.length, 1);
  assert.deepEqual(
    new Session(saved[0]).options().authKey,
    original.options().authKey
  );
  backend.start = async () => {
    throw new Error('login failed');
  };
  await assert.rejects(client.start({}), /login failed/);
  assert.equal(saved.length, 1);
});
