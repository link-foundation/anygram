import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as anygram from '../src/index.js';
import schema from '../src/schema/telegram.json' with { type: 'json' };
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { gramClassName, gramRequest, requestOf } from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { runCorpus } from '../experiments/schema-corpus.mjs';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import TelegramUserClient from '../examples/telegram-user-client.js';
import { FollowClient } from '../examples/follow-client.js';

function namespace() {
  assert(anygram.Api, 'The native class namespace is unavailable');
  return anygram.Api;
}

const at = (api, name) =>
  gramClassName(name)
    .split('.')
    .reduce((scope, key) => scope?.[key], api);

it('provides the shared namespace to direct follow bridges before connection setup', () => {
  assert.equal(new FollowClient({}).Api, namespace());
});

it('exposes every pinned method and constructor through the native class namespace', () => {
  const Api = namespace();
  for (const definition of [...schema.methods, ...schema.constructors]) {
    const name = definition.method ?? definition.predicate;
    const Constructor = at(Api, name);
    assert.equal(typeof Constructor, 'function', name);
    assert.equal(Constructor.className, gramClassName(name));
    assert.equal(Constructor.CONSTRUCTOR_ID, Number(definition.id) >>> 0);
    assert.equal(
      Constructor.classType,
      definition.method ? 'request' : 'constructor'
    );
    for (const oracle of [at(GramApi, name), at(TeleApi, name)]) {
      if (oracle?.CONSTRUCTOR_ID === Constructor.CONSTRUCTOR_ID) {
        assert.equal(Constructor.SUBCLASS_OF_ID, oracle.SUBCLASS_OF_ID, name);
      }
    }
  }
});

it('serializes all finite native classes with the existing independent schema corpus', () => {
  const result = runCorpus([['anygram', namespace()]]);
  assert.deepEqual(result.failures, []);
  assert.equal(result.counts.anygram, 2627);
  assert.equal(result.counts.teleproto, 2623);
  assert.equal(result.counts.gramjs, 1931);
});

it('preserves mutable camelCase arguments, optional flags and stable random identifiers', () => {
  const Api = namespace();
  const args = { peer: new Api.InputPeerSelf(), message: 'first' };
  const request = new Api.messages.SendMessage(args);
  assert.equal(request.originalArgs, args);
  assert.equal(typeof request.randomId, 'bigint');
  const first = request.getBytes();
  assert.deepEqual(first, request.getBytes());
  request.message = 'second';
  request.noWebpage = true;
  const codec = new TlCodec();
  const decoded = codec.decode(request.getBytes());
  assert.equal(decoded.message, 'second');
  assert.equal(decoded.no_webpage, true);
  assert.equal(decoded.random_id, request.randomId);
  assert.notDeepEqual(first, request.getBytes());
  const explicit = new Api.messages.SendMessage({ ...args, randomId: 0n });
  assert.equal(codec.decode(explicit.getBytes()).random_id, 0n);
  const forward = new Api.messages.ForwardMessages({
    fromPeer: new Api.InputPeerSelf(),
    toPeer: new Api.InputPeerSelf(),
    id: [1, 2],
  });
  assert.equal(forward.randomId.length, 2);
  assert(forward.randomId.every((value) => typeof value === 'bigint'));
  assert.deepEqual(forward.getBytes(), forward.getBytes());
});

for (const [name, Api] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`reconstructs native classes as actual ${name} requests and preserves vendor originals`, async () => {
    const NativeApi = namespace();
    const native = new NativeApi.users.GetUsers({
      id: [new NativeApi.InputUserSelf()],
    });
    const client = new anygram.Anygram({
      adapters: [
        anygram.createAdapter(
          name,
          {
            invoke: async (request) => {
              assert(request instanceof Api.users.GetUsers);
              assert(request.id[0] instanceof Api.InputUserSelf);
              assert.equal(typeof request.resolve, 'function');
              assert.equal(typeof request.readResult, 'function');
              assert.deepEqual(request.getBytes(), native.getBytes());
              return [];
            },
          },
          { Api }
        ),
      ],
    });
    assert.deepEqual(await client.invoke(native), []);
    const original = new Api.users.GetUsers({ id: [] });
    assert.equal(gramRequest(Api, requestOf(original)), original);
    const unconfigured = new anygram.Anygram({
      adapters: [
        anygram.createAdapter(name, {
          invoke: () => assert.fail('Missing schema was invoked'),
        }),
      ],
    });
    await assert.rejects(unconfigured.invoke(native), /namespace/);
  });
}

for (const backend of ['mtproto', 'mtcute']) {
  it(`converts native classes through the shared ${backend} object adapter`, async () => {
    const Api = namespace();
    let calls = 0;
    const client = new anygram.Anygram({
      adapters: [
        anygram.createAdapter(backend, {
          async call(method, params) {
            calls++;
            const request =
              backend === 'mtproto' ? { _: method, ...params } : method;
            const peer = request.peer;
            assert.equal(request._, 'messages.sendMessage');
            assert.equal(peer._, 'inputPeerUser');
            assert.equal(String(peer.user_id ?? peer.userId), '7');
            assert.equal(String(peer.access_hash ?? peer.accessHash), '-17');
            assert.equal(String(request.random_id ?? request.randomId), '99');
            return { _: 'updatesTooLong' };
          },
        }),
      ],
    });
    const result = await client.invoke(
      new Api.messages.SendMessage({
        peer: new Api.InputPeerUser({ userId: 7n, accessHash: -17n }),
        message: 'hello',
        randomId: 99n,
      })
    );
    assert.equal(result._, 'updatesTooLong');
    assert.equal(calls, 1);
  });
}

it('uses shared fixed-integer encoding and rejects invalid class arguments without fabricating bytes', () => {
  const Api = namespace();
  const nonce = new Api.ReqPqMulti({ nonce: -1n });
  const bytes = nonce.getBytes();
  assert.deepEqual(bytes.subarray(4), Buffer.alloc(16, 255));
  bytes.fill(0);
  assert.notDeepEqual(nonce.getBytes(), bytes);
  assert.throws(() => new Api.InputPeerSelf([]), /arguments/i);
  assert.throws(() => new Api.InputPeerSelf('bad'), /arguments/i);
  assert.throws(() => new Api.users.GetUsers().getBytes(), /id/);
  assert.throws(
    () =>
      new Api.messages.ViewSponsoredMessage({
        peer: new Api.InputPeerSelf(),
      }).getBytes(),
    /random_id/
  );
});

it('provides the native namespace to original follow callbacks over encrypted TCP', async () => {
  const Api = namespace();
  const peer = await secretRpcPeer((request) => {
    assert.equal(request._, 'users.getUsers');
    assert.deepEqual(request.id, [{ _: 'inputUserSelf' }]);
    return [{ _: 'user', id: 7n, self: true, first_name: 'Ada' }];
  });
  const client = new TelegramUserClient({
    apiId: 777,
    apiHash: 'a'.repeat(32),
    envFile: false,
    env: {},
    factory: async (options) => {
      peer.client.apiHash = options.apiHash;
      return new anygram.Anygram({
        adapters: [
          anygram.createAdapter('native', peer.client, { kind: 'mtproto' }),
        ],
      });
    },
  });
  try {
    assert.equal(client.Api, Api);
    await client.withConnection(async (view, namespace) => {
      assert.equal(namespace, Api);
      const result = await view.invoke(
        new namespace.users.GetUsers({ id: [new namespace.InputUserSelf()] })
      );
      assert.equal(result[0].firstName, 'Ada');
    });
    assert.equal(peer.client.transport.closed, true);
  } finally {
    await peer.close();
  }
});
