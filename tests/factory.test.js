import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createClient } from '../src/index.js';
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
