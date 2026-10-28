import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createAdapter } from '../src/adapters.js';
import { requestOf } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { __tlWriterMap } from '../node_modules/@mtcute/core/tl/binary/writer.js';
import { TlBinaryWriter } from '@mtcute/tl-runtime';
it('serializes mtcute requests with real camelCase, Long values and 53-bit IDs', async () => {
  const input = {
    _: 'messages.sendMessage',
    peer: {
      _: 'inputPeerUser',
      user_id: 1234567890123n,
      access_hash: -9007199254740993n,
    },
    message: 'hi',
    random_id: 9223372036854775807n,
  };
  const adapter = createAdapter('mtcute', {
    call: async (request) => {
      assert.equal(request.peer.userId, 1234567890123);
      assert.equal(request.randomId.toString(), '9223372036854775807');
      assert.deepEqual(
        TlBinaryWriter.serializeObject(__tlWriterMap, request),
        new TlCodec().encode(input)
      );
      return true;
    },
  });
  assert.equal(await adapter.invoke(requestOf(input)), true);
  await assert.rejects(
    adapter.invoke(
      requestOf({
        ...input,
        peer: { ...input.peer, user_id: 9007199254740993n },
      })
    ),
    /53-bit/
  );
});
