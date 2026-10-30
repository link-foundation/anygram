import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api as GramApi } from 'telegram/tl/index.js';
import { objectRequest, gramRequest, requestOf } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { Mtproto } from '../src/mtproto.js';

function recursiveProbe() {
  let reads = 0;
  const value = { _: 'invokeWithoutUpdates' };
  Object.defineProperty(value, 'query', {
    enumerable: true,
    get() {
      if (++reads > 8) {
        throw new Error('Probe exceeded bounded traversal');
      }
      return value;
    },
  });
  return value;
}

function oversizedVector() {
  const value = new Array(3);
  Object.defineProperty(value, 0, {
    get() {
      throw new Error('Probe visited rejected vector');
    },
  });
  return value;
}

for (const [name, convert] of [
  ['canonical', (request, limits) => objectRequest(request, limits)],
  ['vendor', (request, limits) => gramRequest(GramApi, request, limits)],
]) {
  it(`bounds ${name} request depth before visiting excessive nested fields`, () => {
    const value = recursiveProbe();
    assert.throws(
      () => convert(requestOf(value), { maxDepth: 4 }),
      /depth limit/i
    );
  });

  it(`bounds ${name} vectors before inspecting their elements`, () => {
    assert.throws(
      () =>
        convert(requestOf('users.getUsers', { id: oversizedVector() }), {
          maxVector: 2,
        }),
      /vector length/i
    );
  });

  it(`retains valid ${name} boundary values and repeated acyclic references`, () => {
    const peer = { _: 'inputUserSelf' };
    const value = convert(requestOf('users.getUsers', { id: [peer, peer] }), {
      maxDepth: 2,
      maxVector: 2,
    });
    const codec = new TlCodec();
    const normalized = codec.decode(
      name === 'vendor' ? value.getBytes() : codec.encode(value)
    );
    assert.deepEqual(normalized.id, [peer, peer]);
    assert.throws(
      () => convert(requestOf('help.getConfig'), { maxDepth: -1 }),
      /limit/i
    );
  });
}

it('applies configured codec limits during request normalization before serialization', () => {
  const codec = new TlCodec({ maxDepth: 4, maxVector: 2 });
  assert.throws(() => codec.encode(recursiveProbe()), /depth limit/i);
  assert.throws(
    () => codec.encode({ _: 'users.getUsers', id: oversizedVector() }),
    /vector length/i
  );
});

it('rejects oversized native calls before queuing transport work', async () => {
  const client = new Mtproto({
    codec: new TlCodec({ maxDepth: 4, maxVector: 2 }),
    transport: {
      request: () => assert.fail('Rejected request reached transport'),
    },
  });
  try {
    assert.throws(() => client.call(recursiveProbe()), /depth limit/i);
    assert.throws(
      () => client.call('users.getUsers', { id: oversizedVector() }),
      /vector length/i
    );
  } finally {
    await client.disconnect();
  }
});
