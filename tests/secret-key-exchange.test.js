import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createDiffieHellman, createHash, getDiffieHellman } from 'node:crypto';
import * as protocol from '../src/mtproto.js';
import {
  telegramDhPrime as prime,
  dhConfig,
} from '../experiments/secret-dh-fixtures.mjs';

const exchange = (options = {}) =>
  new protocol.SecretChatKeyExchange({ p: prime, g: 3, ...options });
const hashFingerprint = (key) =>
  createHash('sha1').update(key).digest().readBigInt64LE(12);
const bigBytes = (value) =>
  Buffer.from(value.toString(16).padStart(512, '0'), 'hex');
const primeValue = BigInt(`0x${prime.toString('hex')}`);

it('derives the same 256-byte secret key on both sides and consumes private exponents', () => {
  const left = exchange();
  const right = exchange({ serverRandom: new Uint8Array(256).fill(71) });
  const leftPublic = left.publicValue;
  const rightPublic = right.publicValue;
  const a = left.complete(rightPublic);
  const b = right.complete(leftPublic, a.fingerprint);
  assert.equal(a.key.length, 256);
  assert.deepEqual(a.key, b.key);
  assert.equal(a.fingerprint, hashFingerprint(a.key));
  assert.equal(b.fingerprint, a.fingerprint);
  assert.throws(() => left.complete(rightPublic), /destroyed/i);
  assert.throws(() => left.exportState(), /destroyed/i);
  left.destroy();
});

it('interoperates with platform DH and copies public inputs/outputs', () => {
  // Deno's Node compatibility API accepts only generators 2 and 5. RFC 3526's
  // 2048-bit MODP group also satisfies Telegram's safe-prime requirements.
  const input = Uint8Array.from(getDiffieHellman('modp14').getPrime());
  const local = exchange({ p: input, g: 2 });
  const peer = createDiffieHellman(input, 2);
  const remotePublic = peer.generateKeys();
  const publicValue = local.publicValue;
  const expected = peer.computeSecret(publicValue);
  input.fill(0);
  local.publicValue.fill(0);
  assert.deepEqual(local.publicValue, publicValue);
  const result = local.complete(remotePublic);
  assert.deepEqual(Buffer.from(result.key), expected);
  assert.equal(result.fingerprint, hashFingerprint(expected));
});

it('rejects unsafe primes, generators, public values and fingerprints', () => {
  for (const options of [
    { p: new Uint8Array(257) },
    { p: new Uint8Array(256) },
    { p: bigBytes(primeValue - 2n) },
    { p: bigBytes((1n << 2048n) - 1n), g: 4 },
    { g: 1 },
    { g: 8 },
    { g: 3.5 },
    { serverRandom: new Uint8Array(255) },
  ]) {
    assert.throws(() => exchange(options));
  }
  const bound = 1n << 1984n;
  for (const publicValue of [
    new Uint8Array(257),
    new Uint8Array(),
    bigBytes(0n),
    bigBytes(1n),
    bigBytes(bound),
    bigBytes(primeValue - bound),
    bigBytes(primeValue - 1n),
  ]) {
    const local = exchange();
    assert.throws(() => local.complete(publicValue), /public/i);
    assert.throws(() => local.exportState(), /destroyed/i);
  }
  const left = exchange();
  const right = exchange();
  const fingerprint = left.complete(right.publicValue).fingerprint;
  assert.throws(
    () => right.complete(left.publicValue, fingerprint ^ 1n),
    /fingerprint/i
  );
  assert.throws(() => right.exportState(), /destroyed/i);
});

it('restores a bounded portable pending exchange without retaining caller state', () => {
  const original = exchange();
  const state = JSON.parse(JSON.stringify(original.exportState()));
  const restored = exchange({ state });
  assert.deepEqual(restored.publicValue, original.publicValue);
  const other = exchange();
  const originalPublic = original.publicValue;
  const otherPublic = other.publicValue;
  state.privateValue = '';
  const first = restored.complete(otherPublic);
  assert.deepEqual(other.complete(originalPublic).key, first.key);
  original.destroy();
  const snapshot = exchange().exportState();
  for (const changes of [
    { version: 2 },
    { g: 4 },
    { p: Buffer.alloc(256).toString('base64') },
    { privateValue: '!!!!' },
    { privateValue: 'A'.repeat(400) },
    { privateValue: Buffer.alloc(256).toString('base64') },
  ]) {
    assert.throws(() => exchange({ state: { ...snapshot, ...changes } }));
  }
});

it('always mixes local entropy rather than using server randomness as the private exponent', () => {
  const serverRandom = new Uint8Array(256).fill(82);
  const left = exchange({ serverRandom });
  const right = exchange({ serverRandom });
  assert.notDeepEqual(left.publicValue, right.publicValue);
  const privateValue = Buffer.from(left.exportState().privateValue, 'base64');
  assert.notDeepEqual(privateValue, Buffer.from(serverRandom));
  serverRandom.fill(0);
  const rightPublic = right.publicValue;
  const leftPublic = left.publicValue;
  assert.deepEqual(
    left.complete(rightPublic).key,
    right.complete(leftPublic).key
  );
});

it('refreshes DH configuration before each initial exchange and handles not-modified replies', async () => {
  const requests = [];
  const invoke = async (method, params, options) => {
    requests.push({ method, params, options });
    return requests.length === 1
      ? dhConfig()
      : {
          _: 'messages.dhConfigNotModified',
          random: new Uint8Array(256).fill(5),
        };
  };
  const first = await protocol.createSecretChatKeyExchange(invoke);
  const second = await protocol.createSecretChatKeyExchange(invoke, {
    config: first.config,
    timeout: 1234,
  });
  assert.deepEqual(
    requests.map(({ method, params }) => ({ method, params })),
    [
      {
        method: 'messages.getDhConfig',
        params: { version: 0, random_length: 256 },
      },
      {
        method: 'messages.getDhConfig',
        params: { version: 7, random_length: 256 },
      },
    ]
  );
  assert.equal(requests[1].options.timeout, 1234);
  assert.deepEqual(second.config, first.config);
  assert.notDeepEqual(second.exchange.publicValue, first.exchange.publicValue);
  first.config.p.fill(0);
  assert.deepEqual(second.config.p, Uint8Array.from(prime));
  first.exchange.destroy();
  second.exchange.destroy();
});

it('rejects malformed config replies and cancellation before generating an exchange', async () => {
  for (const response of [
    null,
    { _: 'messages.dhConfigNotModified', random: new Uint8Array(256) },
    { ...dhConfig(), random: new Uint8Array(255) },
    { ...dhConfig(), version: -1 },
    { ...dhConfig(), p: new Uint8Array(257) },
    { ...dhConfig(), _: 'unexpected' },
  ]) {
    await assert.rejects(
      protocol.createSecretChatKeyExchange(async () => response)
    );
  }
  const controller = new globalThis.AbortController();
  controller.abort(Error('cancelled'));
  await assert.rejects(
    protocol.createSecretChatKeyExchange(
      () => {
        throw Error('must not call');
      },
      {
        signal: controller.signal,
      }
    ),
    /cancelled/
  );
  const later = new globalThis.AbortController();
  await assert.rejects(
    protocol.createSecretChatKeyExchange(
      async () => {
        later.abort(Error('cancelled after RPC'));
        return dhConfig();
      },
      { signal: later.signal }
    ),
    /cancelled after RPC/
  );
});

it('validates cached config before allocation/RPC and copies it before asynchronous refresh', async () => {
  for (const config of [
    { p: new Uint8Array(257), g: 3, version: 1 },
    { p: { length: 0x7fffffff }, g: 3, version: 1 },
    { p: prime, g: 8, version: 1 },
    { p: prime, g: 3, version: 0x80000000 },
  ]) {
    await assert.rejects(
      protocol.createSecretChatKeyExchange(
        () => {
          throw Error('must not invoke');
        },
        { config }
      ),
      /DH/
    );
  }
  const config = { p: Uint8Array.from(prime), g: 3, version: 7 };
  const refreshed = await protocol.createSecretChatKeyExchange(
    async () => {
      config.p.fill(0);
      config.g = 8;
      config.version = -1;
      return { _: 'messages.dhConfigNotModified', random: new Uint8Array(256) };
    },
    { config }
  );
  assert.deepEqual(refreshed.config.p, Uint8Array.from(prime));
  assert.equal(refreshed.config.g, 3);
  assert.equal(refreshed.config.version, 7);
  refreshed.exchange.destroy();
});
