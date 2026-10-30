import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { returnBigInt } from 'telegram/Helpers.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { TlBinaryWriter } from '@mtcute/tl-runtime';
import { __tlWriterMap } from '../node_modules/@mtcute/core/tl/binary/writer.js';
import { TlCodec } from '../src/tl.js';
import { gramRequest, objectRequest, requestOf } from '../src/requests.js';
import { mtcuteRequest } from '../src/mtcute.js';

const codec = new TlCodec();
const nonce = (1n << 127n) + 37n;
const publicKey = (1n << 255n) + 73n;

for (const [label, Api] of [
  ['GramJS', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`encodes ${label} fixed-width big integers without losing bits`, () => {
    for (const value of [
      0n,
      1n,
      -1n,
      -(1n << 127n),
      nonce,
      (1n << 128n) - 1n,
    ]) {
      const input = new Api.ResPQ({
        nonce: returnBigInt(value),
        serverNonce: -1n,
        pq: Buffer.from([3]),
        serverPublicKeyFingerprints: [7n],
      });
      assert.deepEqual(Buffer.from(codec.encode(input)), input.getBytes());
      const normalized = objectRequest(requestOf(input));
      assert(normalized.nonce instanceof Uint8Array);
      assert.equal(normalized.nonce.length, 16);
    }
  });

  it(`resolves ${label} protocol class names and converts canonical requests back`, () => {
    for (const [name, input] of [
      ['req_pq_multi', new Api.ReqPqMulti({ nonce })],
      [
        'p_q_inner_data',
        new Api.PQInnerData({
          pq: Buffer.from([15]),
          p: Buffer.from([3]),
          q: Buffer.from([5]),
          nonce,
          serverNonce: -1n,
          newNonce: returnBigInt(publicKey),
        }),
      ],
    ]) {
      assert.equal(requestOf(input).method, name);
      const canonical = codec.decode(input.getBytes());
      assert.deepEqual(Buffer.from(codec.encode(input)), input.getBytes());
      assert.deepEqual(
        gramRequest(Api, requestOf(canonical)).getBytes(),
        input.getBytes()
      );
      assert.equal(requestOf(input.className).method, name);
    }
  });
}

it('normalizes optional int256 call fields for native and actual mtcute writers', async () => {
  const input = new TeleApi.phone.JoinGroupCall({
    call: new TeleApi.InputGroupCall({ id: 7n, accessHash: -11n }),
    joinAs: new TeleApi.InputPeerSelf(),
    publicKey,
    block: Buffer.from([1, 2, 3]),
    params: new TeleApi.DataJSON({ data: '{}' }),
  });
  const canonical = objectRequest(requestOf(input));
  assert(canonical.public_key instanceof Uint8Array);
  assert.equal(canonical.public_key.length, 32);
  assert.deepEqual(Buffer.from(codec.encode(input)), input.getBytes());
  assert.deepEqual(
    gramRequest(TeleApi, requestOf(codec.decode(input.getBytes()))).getBytes(),
    input.getBytes()
  );
  const converted = await mtcuteRequest(requestOf(input));
  assert.deepEqual(
    Buffer.from(TlBinaryWriter.serializeObject(__tlWriterMap, converted)),
    input.getBytes()
  );
});

it('encodes finite signed and unsigned fixed-width boundaries and rejects overflow', () => {
  for (const [type, bits] of [
    ['int128', 128n],
    ['int256', 256n],
  ]) {
    const width = Number(bits / 8n);
    assert.deepEqual(codec.encode(-1n, type), new Uint8Array(width).fill(255));
    assert.deepEqual(
      codec.encode((1n << bits) - 1n, type),
      codec.encode(-1n, type)
    );
    assert.equal(codec.encode(-(1n << (bits - 1n)), type).at(-1), 128);
    for (const value of [1n << bits, -(1n << (bits - 1n)) - 1n]) {
      assert.throws(() => codec.encode(value, type), /range/i);
    }
    for (const value of [
      Number.MAX_SAFE_INTEGER + 1,
      1.5,
      '1',
      new Uint8Array(width - 1),
    ]) {
      assert.throws(() => codec.encode(value, type), /integer|width/i);
    }
  }
});
