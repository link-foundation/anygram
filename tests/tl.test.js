import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { TlCodec } from '../src/tl.js';

describe('independent TL codec', () => {
  it('round trips flags, nested objects and exact signed 64-bit IDs', () => {
    const codec = new TlCodec();
    const request = {
      _: 'messages.sendMessage',
      peer: {
        _: 'inputPeerUser',
        user_id: 9007199254740993n,
        access_hash: -7n,
      },
      message: 'Hello 👋',
      random_id: -9223372036854775808n,
      silent: true,
    };
    const decoded = codec.decode(codec.encode(request));
    assert.equal(decoded.peer.user_id, request.peer.user_id);
    assert.equal(decoded.random_id, request.random_id);
    assert.equal(decoded.message, request.message);
    assert.equal(decoded.silent, true);
    assert.equal(decoded.no_webpage, false);
  });

  it('encodes byte strings at both TL length boundaries', () => {
    const codec = new TlCodec();
    for (const size of [0, 1, 253, 254, 255, 1024]) {
      const request = {
        _: 'upload.saveFilePart',
        file_id: 1n,
        file_part: 0,
        bytes: new Uint8Array(size).fill(37),
      };
      const encoded = codec.encode(request);
      assert.equal(encoded.length % 4, 0);
      assert.deepEqual(codec.decode(encoded).bytes, request.bytes);
    }
  });

  it('copies decoded byte fields from Buffer and Uint8Array input views', () => {
    const codec = new TlCodec();
    for (const [type, size] of [
      ['bytes', 7],
      ['bytes', 254],
      ['int128', 16],
      ['int256', 32],
    ]) {
      const expected = new Uint8Array(size).fill(37);
      const encoded = codec.encode(expected, type);
      for (const allocate of [
        (size) => Buffer.alloc(size),
        (size) => new Uint8Array(size),
      ]) {
        const storage = allocate(encoded.length + 32);
        const input = storage.subarray(16, 16 + encoded.length);
        input.set(encoded);
        const first = codec.decode(input, type);
        const second = codec.decode(input, type);
        first.fill(9);
        assert.deepEqual(Array.from(input), Array.from(encoded));
        assert.deepEqual(Array.from(second), Array.from(expected));
        storage.fill(0);
        assert.deepEqual(Array.from(second), Array.from(expected));
      }
    }
  });

  it('rejects missing fields, unsafe IDs and truncated data', () => {
    const codec = new TlCodec();
    assert.throws(
      () =>
        codec.encode({
          _: 'inputPeerUser',
          user_id: Number.MAX_SAFE_INTEGER + 1,
          access_hash: 1n,
        }),
      /integer|safe/i
    );
    assert.throws(
      () => codec.encode({ _: 'inputPeerUser', user_id: 1n }),
      /access_hash/
    );
    assert.throws(() => codec.decode(new Uint8Array([1, 2, 3])), /truncated/i);
    assert.throws(() => codec.decode(new Uint8Array(4)), /constructor/i);
  });

  it('bounds vector allocations and nesting on untrusted input', () => {
    const codec = new TlCodec({ maxVector: 4, maxDepth: 4 });
    const vector = new Uint8Array([
      0x15, 0xc4, 0xb5, 0x1c, 0xff, 0xff, 0xff, 0x7f,
    ]);
    assert.throws(() => codec.decode(vector, 'Vector<int>'), /vector/i);
    let request = { _: 'help.getConfig' };
    for (let i = 0; i < 6; i++) {
      request = { _: 'invokeWithoutUpdates', query: request };
    }
    assert.throws(() => codec.encode(request), /depth/i);
  });

  it('handles every schema method without hard-coded RPC whitelists', () => {
    const codec = new TlCodec();
    assert(codec.methods.size > 780);
    assert(codec.constructors.size > 1500);
    assert(codec.methods.has('stories.sendStory'));
    assert(codec.methods.has('phone.requestCall'));
    assert(codec.methods.has('messages.sendEncrypted'));
  });

  it('rejects constructors of the wrong declared type', () => {
    const codec = new TlCodec();
    assert.throws(
      () => codec.encode({ _: 'inputUserSelf' }, 'InputPeer'),
      /type/i
    );
    assert.throws(
      () => codec.decode(codec.encode(true, 'Bool'), 'InputPeer'),
      /type/i
    );
    assert.throws(
      () => codec.decode(codec.encode({ _: 'inputUserSelf' }), 'InputPeer'),
      /type/i
    );
  });

  it('reads historical constructor IDs while writing the latest definition of a name', () => {
    const codec = new TlCodec({
      registry: {
        layer: 2,
        methods: [],
        constructors: [
          {
            id: '1',
            predicate: 'versioned',
            params: [{ name: 'value', type: 'int' }],
            type: 'Versioned',
          },
          {
            id: '2',
            predicate: 'versioned',
            params: [{ name: 'value', type: 'long' }],
            type: 'Versioned',
          },
        ],
      },
    });
    assert.deepEqual(codec.decode(new Uint8Array([1, 0, 0, 0, 7, 0, 0, 0])), {
      _: 'versioned',
      value: 7,
    });
    const latest = codec.encode({ _: 'versioned', value: 9007199254740993n });
    assert.equal(
      new DataView(latest.buffer, latest.byteOffset).getUint32(0, true),
      2
    );
    assert.equal(codec.decode(latest).value, 9007199254740993n);
  });
});
