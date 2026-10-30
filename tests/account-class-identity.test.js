import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { Api, Anygram, createAdapter } from '../src/index.js';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import { gramView } from '../src/gram-style.js';
import {
  gramClassName,
  gramRequest,
  requestOf,
  objectRequest,
  camel,
} from '../src/requests.js';
import { TlCodec } from '../src/tl.js';
import { createFixtureFactory } from '../experiments/tl-fixtures.mjs';
import { runCorpus } from '../experiments/schema-corpus.mjs';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';
import { messagePage } from './fixtures/account-message-models.js';

const codec = new TlCodec();
const fixture = createFixtureFactory(codec);
const at = (scope, name) =>
  gramClassName(name)
    .split('.')
    .reduce((value, key) => value?.[key], scope);

it('retains native API class identity and serialization for all 2627 finite schema views', () => {
  let compared = 0;
  for (const definition of [
    ...codec.methods.values(),
    ...codec.constructors.values(),
  ]) {
    const name = definition.method ?? definition.predicate;
    if (['boolTrue', 'boolFalse'].includes(name)) {
      continue;
    }
    const source = fixture(definition);
    const view = gramView(source);
    const Constructor = at(Api, name);
    assert(view instanceof Constructor, name);
    assert.equal(view.classType, definition.method ? 'request' : 'constructor');
    assert.equal(view.CONSTRUCTOR_ID, Constructor.CONSTRUCTOR_ID);
    assert.equal(view.SUBCLASS_OF_ID, Constructor.SUBCLASS_OF_ID);
    assert.equal(Object.getPrototypeOf(view), Object.prototype);
    assert.deepEqual(Object.keys(view), [
      ...Object.keys(source).map(camel),
      'className',
    ]);
    assert.deepEqual(
      Buffer.from(view.getBytes()),
      Buffer.from(codec.encode(source)),
      name
    );
    compared++;
  }
  assert.equal(compared, 2627);
});

it('matches every compatible actual SDK corpus entry through shared class views', () => {
  const Views = {};
  for (const definition of [
    ...codec.methods.values(),
    ...codec.constructors.values(),
  ]) {
    const name = definition.method ?? definition.predicate;
    const path = gramClassName(name).split('.');
    const leaf = path.pop();
    const scope = path.reduce((value, key) => (value[key] ??= {}), Views);
    const Constructor = at(Api, name);
    scope[leaf] = class {
      static CONSTRUCTOR_ID = Constructor.CONSTRUCTOR_ID;
      constructor(args) {
        const view = gramView(new Constructor(args));
        assert(view instanceof Constructor, name);
        return view;
      }
    };
  }
  const { counts, failures } = runCorpus([['sharedViews', Views]]);
  assert.deepEqual(failures, []);
  assert.equal(counts.sharedViews, 2627);
  assert.equal(counts.gramjs, 1931);
  assert.equal(counts.teleproto, 2623);
});

for (const [name, Vendor] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`matches actual ${name} guards and bytes for compatible nested models`, () => {
    const source = {
      _: 'inputMediaDocument',
      id: {
        _: 'inputDocument',
        id: 9007199254740993n,
        access_hash: -9007199254740995n,
        file_reference: new Uint8Array([1, 2]),
      },
      spoiler: true,
    };
    const sdk = gramRequest(Vendor, requestOf(source));
    const view = gramView(sdk);
    assert(sdk instanceof Vendor.InputMediaDocument);
    assert(sdk.id instanceof Vendor.InputDocument);
    assert(view instanceof Api.InputMediaDocument);
    assert(view.id instanceof Api.InputDocument);
    assert(!(view instanceof Api.InputMediaPhoto));
    assert.deepEqual(Buffer.from(view.getBytes()), Buffer.from(sdk.getBytes()));
    view.id.fileReference[0] = 99;
    assert.equal(sdk.id.fileReference[0], 1);
    assert.equal(codec.decode(view.getBytes()).id.file_reference[0], 99);
  });
}

it('keeps class guards private rather than accepting copied names or class metadata', () => {
  const view = gramView({ _: 'inputPeerSelf' });
  assert(view instanceof Api.InputPeerSelf);
  assert(!(view instanceof Api.InputPeerEmpty));
  assert(!({ ...view } instanceof Api.InputPeerSelf));
  assert(
    !(
      { _: 'inputPeerSelf', className: 'InputPeerSelf' } instanceof
      Api.InputPeerSelf
    )
  );
  assert(!(null instanceof Api.InputPeerSelf));
  assert(!(7 instanceof Api.InputPeerSelf));
  assert(!({} instanceof Api.InputPeerSelf));
  assert(new Api.InputPeerSelf() instanceof Api.InputPeerSelf);
  assert.equal(
    JSON.stringify(view),
    '{"_":"inputPeerSelf","className":"InputPeerSelf"}'
  );
  assert.deepEqual(view.toJSON(), {
    _: 'inputPeerSelf',
    className: 'InputPeerSelf',
  });
  assert.deepEqual(Object.keys(view), ['_', 'className']);
  assert.equal(gramView({ _: 'unknownFutureObject' }).getBytes, undefined);
});

it('preserves subclass and native constructor instance semantics', () => {
  class Derived extends Api.InputPeerSelf {}
  const view = gramView({ _: 'inputPeerSelf' });
  const own = new Api.InputPeerSelf();
  const derived = new Derived();
  assert(derived instanceof Derived);
  assert(derived instanceof Api.InputPeerSelf);
  assert(!(view instanceof Derived));
  assert(!(own instanceof Derived));
  assert(view instanceof Api.InputPeerSelf);
  assert.equal(Object.getPrototypeOf(view), Object.prototype);
});

it('resolves request views with the shared resolver and serializes the resolved fields', async () => {
  const request = gramView({
    _: 'messages.sendMessage',
    peer: 'me',
    message: 'Resolved',
    random_id: 7n,
  });
  const calls = [];
  await request.resolve({
    async getInputEntity(peer) {
      calls.push(peer);
      return new Api.InputPeerSelf();
    },
  });
  assert.deepEqual(calls, ['me']);
  assert(request instanceof Api.messages.SendMessage);
  assert(request.peer instanceof Api.InputPeerSelf);
  assert.equal(codec.decode(request.getBytes()).peer._, 'inputPeerSelf');
  await assert.rejects(
    gramView({ _: 'inputPeerSelf' }).resolve({}),
    /requires a request/
  );
});

for (const [name, Vendor] of [
  ['gramjs', GramApi],
  ['teleproto', TeleApi],
]) {
  it(`reconstructs privately branded request views using actual ${name} constructors`, async () => {
    const view = gramView({
      _: 'messages.readHistory',
      peer: { _: 'inputPeerSelf' },
      max_id: 7,
    });
    let invoked = 0;
    const client = new Anygram({
      adapters: [
        createAdapter(
          name,
          {
            async invoke(request) {
              invoked++;
              assert.notEqual(request, view);
              assert(request instanceof Vendor.messages.ReadHistory);
              assert(request.peer instanceof Vendor.InputPeerSelf);
              assert.deepEqual(
                Buffer.from(request.getBytes()),
                Buffer.from(view.getBytes())
              );
              return new Vendor.UpdatesTooLong();
            },
          },
          { Api: Vendor }
        ),
      ],
    });
    await client.invoke(view);
    assert.equal(invoked, 1);
  });
}

for (const style of ['gramjs', 'teleproto']) {
  for (const backend of [
    'native',
    'gramjs',
    'teleproto',
    'mtcute',
    'mtproto',
  ]) {
    it(`retains ${style} bound message guards and origin through selected ${backend}`, async () => {
      const Vendor = backend === 'gramjs' ? GramApi : TeleApi;
      const source = messagePage();
      const response = ['gramjs', 'teleproto'].includes(backend)
        ? gramRequest(Vendor, requestOf(source))
        : source;
      const calls = [];
      const call = async (method, params) => {
        const request =
          typeof method === 'string' ? { method, params } : requestOf(method);
        calls.push(objectRequest(request));
        return request.method === 'messages.getHistory'
          ? response
          : { _: 'updatesTooLong' };
      };
      const client = new Anygram({
        adapters: [
          createAdapter(
            backend,
            ['gramjs', 'teleproto'].includes(backend)
              ? { invoke: async (request) => call(request) }
              : { call },
            { kind: backend === 'native' ? 'mtproto' : backend, Api: Vendor }
          ),
        ],
      });
      const [message] = await client[style].getMessages({
        _: 'inputPeerUser',
        user_id: 9n,
        access_hash: 17n,
      });
      assert(message instanceof Api.Message);
      assert(!(message instanceof Api.MessageService));
      assert(message.peerId instanceof Api.PeerUser);
      assert(message.photo instanceof Api.Photo);
      assert(message.media instanceof Api.MessageMediaPhoto);
      assert.equal(codec.decode(message.getBytes()).id, 7);
      await message.reply({ message: 'Reply', parseMode: false });
      const canonical = calls.at(-1);
      assert.equal(canonical._, 'messages.sendMessage');
      assert.equal(canonical.peer.access_hash, 17n);
      assert.equal(canonical.reply_to.reply_to_msg_id, 7);
      assert.equal(message.text, 'Original');
    });
  }
}

for (const style of ['gramjs', 'teleproto']) {
  it(`retains ${style} class guards after independent encrypted native TCP decoding`, async () => {
    const remote = await secretRpcPeer(() => messagePage());
    try {
      const client = new Anygram({
        adapters: [createAdapter('native', remote.client, { kind: 'mtproto' })],
      });
      const [message] = await client[style].getMessages({
        _: 'inputPeerUser',
        user_id: 9n,
        access_hash: 17n,
      });
      assert(message instanceof Api.Message);
      assert(message.photo instanceof Api.Photo);
      assert(message.replyTo instanceof Api.MessageReplyHeader);
      assert.deepEqual(
        Buffer.from(message.media.getBytes()),
        Buffer.from(codec.encode(messagePage().messages[0].media))
      );
    } finally {
      await remote.close();
    }
  });
}

it('keeps canonical raw results unbranded and preserves their original identity', async () => {
  const source = messagePage();
  const client = new Anygram({
    adapters: [
      createAdapter(
        'native',
        { call: async () => source },
        { kind: 'mtproto' }
      ),
    ],
  });
  const result = await client.invoke('messages.getHistory', {});
  assert.equal(result, source);
  assert(!(result.messages[0] instanceof Api.Message));
  assert.equal(result.messages[0].getBytes, undefined);
});
