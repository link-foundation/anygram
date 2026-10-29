import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as protocol from '../src/mtproto.js';
import { dhConfig } from '../experiments/secret-dh-fixtures.mjs';
import { secretRpcPeer } from '../experiments/secret-rpc-peer.mjs';

const alice = 9007199254740993n;
const bob = 9007199254740995n;
const user = { _: 'inputUser', user_id: bob, access_hash: -123n };
const copy = (value) => JSON.parse(JSON.stringify(value));
const waiting = (id) => ({
  _: 'encryptedChatWaiting',
  id,
  access_hash: -456n,
  date: 1,
  admin_id: alice,
  participant_id: bob,
});
const requested = (request) => ({
  ...waiting(request.random_id),
  _: 'encryptedChatRequested',
  g_a: request.g_a,
});
const active = (request, acceptance, originator) => ({
  ...waiting(request.random_id),
  _: 'encryptedChat',
  g_a_or_b: originator ? acceptance.g_b : request.g_a,
  key_fingerprint: acceptance.key_fingerprint,
});
const configRpc = async (method) => {
  assert.equal(method, 'messages.getDhConfig');
  return dhConfig();
};
const prepare = () =>
  protocol.createSecretChatRequest(configRpc, { selfId: alice, user });

async function peerFor(handshake) {
  let request;
  await handshake.submit(
    async (method, params) => {
      request = params;
      return waiting(params.random_id);
    },
    { save: async () => {} }
  );
  const { handshake: peer } = await protocol.createSecretChatAcceptance(
    configRpc,
    { selfId: bob, chat: requested(request) }
  );
  return { request, peer };
}

it('persists request and acceptance before RPCs and establishes equal keys through actual DH', async () => {
  const { handshake: left } = await prepare();
  let request, acceptance, leftSaved, rightSaved;
  await left.submit(
    async (method, params) => {
      assert.equal(method, 'messages.requestEncryption');
      assert.equal(leftSaved.phase, 'requesting');
      assert.ok(leftSaved.exchange.privateValue);
      assert.equal(leftSaved.chatId, params.random_id);
      assert.deepEqual(params.user_id, user);
      request = params;
      return waiting(params.random_id);
    },
    { save: async (state) => (leftSaved = copy(state)) }
  );
  assert.equal(left.state.phase, 'waiting');
  assert.throws(() => left.credentials(), /ready/i);
  const { handshake: right } = await protocol.createSecretChatAcceptance(
    configRpc,
    { selfId: bob, chat: requested(request) }
  );
  await right.submit(
    async (method, params) => {
      assert.equal(method, 'messages.acceptEncryption');
      assert.equal(rightSaved.phase, 'accepting');
      assert.equal(rightSaved.exchange, null);
      assert.ok(rightSaved.key);
      assert.deepEqual(params.peer, {
        _: 'inputEncryptedChat',
        chat_id: request.random_id,
        access_hash: -456n,
      });
      acceptance = params;
      return active(request, params, false);
    },
    { save: async (state) => (rightSaved = copy(state)) }
  );
  await left.apply(configRpc, active(request, acceptance, true), {
    save: async (state) => (leftSaved = copy(state)),
  });
  assert.equal(leftSaved.phase, 'ready');
  assert.equal(rightSaved.phase, 'ready');
  assert.equal(leftSaved.exchange, null);
  const first = left.credentials();
  const second = right.credentials();
  assert.deepEqual(first.key, second.key);
  assert.equal(first.fingerprint, second.fingerprint);
  assert.equal(first.originator, true);
  assert.equal(second.originator, false);
  assert.deepEqual(first.dh, { p: dhConfig().p, g: dhConfig().g });
  assert.deepEqual(second.dh, first.dh);
  first.dh.p.fill(0);
  assert.notDeepEqual(left.credentials().dh.p, first.dh.p);
  first.key.fill(0);
  assert.notDeepEqual(left.credentials().key, first.key);
  left.destroy();
  right.destroy();
});

it('retries a lost request with the same chat ID and DH value after JSON restoration', async () => {
  const { handshake } = await prepare();
  let saved, sent;
  const lost = new Error('lost response');
  await assert.rejects(
    handshake.submit(
      async (method, params) => {
        sent = params;
        throw lost;
      },
      { save: async (state) => (saved = copy(state)) }
    ),
    (error) => error === lost
  );
  const restored = new protocol.SecretChatHandshake({ state: saved });
  saved.exchange.privateValue = '';
  await restored.submit(
    async (method, params) => {
      assert.equal(method, 'messages.requestEncryption');
      assert.deepEqual(params, sent);
      return waiting(params.random_id);
    },
    { save: async () => {} }
  );
  let calls = 0;
  await restored.submit(async () => calls++, { save: async () => {} });
  assert.equal(calls, 0);
  handshake.destroy();
  restored.destroy();
});

it('never invokes a request before successful persistence and bounds concurrent submissions', async () => {
  const { handshake } = await prepare();
  let calls = 0;
  const invoke = async () => calls++;
  const storageError = new Error('disk full');
  await assert.rejects(
    handshake.submit(invoke, {
      save: async () => {
        throw storageError;
      },
    }),
    (error) => error === storageError
  );
  assert.equal(calls, 0);
  await assert.rejects(handshake.submit(invoke), /save/i);
  let release;
  const blocked = new Promise((resolve) => (release = resolve));
  const pending = handshake.submit(
    async (method, params) => waiting(params.random_id),
    { save: async () => blocked }
  );
  await assert.rejects(
    handshake.submit(invoke, { save: async () => {} }),
    /progress/i
  );
  release();
  await pending;
  assert.equal(calls, 0);
  handshake.destroy();
});

it('rejects unrelated updates without consuming the pending exponent and discards a bad fingerprint', async () => {
  const { handshake } = await prepare();
  let request;
  await handshake.submit(
    async (method, params) => {
      request = params;
      return waiting(params.random_id);
    },
    { save: async () => {} }
  );
  const before = handshake.exportState();
  await assert.rejects(
    handshake.apply(configRpc, waiting(request.random_id + 1), {
      save: async () => {},
    }),
    /chat ID/i
  );
  assert.deepEqual(handshake.exportState(), before);
  const other = new protocol.SecretChatKeyExchange({
    p: dhConfig().p,
    g: 3,
  });
  const otherPublic = other.publicValue;
  const key = other.complete(request.g_a);
  let discarded = 0,
    saved;
  await assert.rejects(
    handshake.apply(
      async (method, params) => {
        assert.equal(method, 'messages.discardEncryption');
        assert.deepEqual(params, { chat_id: request.random_id });
        assert.equal(saved.phase, 'discarded');
        discarded++;
        return true;
      },
      {
        ...waiting(request.random_id),
        _: 'encryptedChat',
        g_a_or_b: otherPublic,
        key_fingerprint: key.fingerprint ^ 1n,
      },
      { save: async (state) => (saved = copy(state)) }
    ),
    /fingerprint/i
  );
  assert.equal(discarded, 1);
  assert.equal(saved.exchange, null);
  assert.equal(saved.key, null);
  assert.throws(() => handshake.credentials(), /ready/i);
  key.key.fill(0);
});

it('validates role binding, public values, cancellation and copied input before asynchronous preparation', async () => {
  const { handshake } = await prepare();
  let request;
  await handshake.submit(
    async (method, params) => {
      request = params;
      return waiting(params.random_id);
    },
    { save: async () => {} }
  );
  await assert.rejects(
    protocol.createSecretChatAcceptance(configRpc, {
      selfId: alice,
      chat: requested(request),
    }),
    /participant/i
  );
  const calls = [];
  await assert.rejects(
    protocol.createSecretChatAcceptance(
      async (method) => {
        calls.push(method);
        return method === 'messages.getDhConfig' ? dhConfig() : true;
      },
      {
        selfId: bob,
        chat: { ...requested(request), g_a: new Uint8Array(256) },
      }
    ),
    /public/i
  );
  assert.deepEqual(calls, [
    'messages.getDhConfig',
    'messages.discardEncryption',
  ]);
  const controller = new globalThis.AbortController();
  const reason = new Error('cancelled');
  controller.abort(reason);
  await assert.rejects(
    handshake.submit(configRpc, {
      signal: controller.signal,
      save: async () => assert.fail('cancelled operation saved'),
    }),
    (error) => error === reason
  );
  const mutableUser = { ...user };
  const pending = protocol.createSecretChatRequest(
    async () => {
      mutableUser.user_id = alice;
      return dhConfig();
    },
    { selfId: alice, user: mutableUser }
  );
  const prepared = (await pending).handshake;
  assert.equal(prepared.state.remoteId, bob);
  prepared.destroy();
  handshake.destroy();
});

it('keeps credentials unavailable until a successful final save and preserves the completed key for retry', async () => {
  const { handshake } = await prepare();
  const { request, peer } = await peerFor(handshake);
  let response;
  await peer.submit(
    async (method, params) => {
      response = active(request, params, true);
      return active(request, params, false);
    },
    { save: async () => {} }
  );
  const diskError = new Error('final write failed');
  await assert.rejects(
    handshake.apply(configRpc, response, {
      save: async () => {
        assert.throws(() => handshake.credentials(), /ready/i);
        throw diskError;
      },
    }),
    (error) => error === diskError
  );
  assert.equal(handshake.state.phase, 'ready');
  assert.throws(() => handshake.credentials(), /ready/i);
  await handshake.apply(configRpc, response, { save: async () => {} });
  assert.deepEqual(handshake.credentials().key, peer.credentials().key);
  // A stale waiting update does not regress an established chat.
  await handshake.apply(configRpc, waiting(request.random_id), {
    save: async () => {},
  });
  assert.equal(handshake.state.phase, 'ready');
  const restored = new protocol.SecretChatHandshake({
    state: copy(handshake.exportState()),
  });
  assert.deepEqual(restored.credentials(), handshake.credentials());
  restored.destroy();
  peer.destroy();
  handshake.destroy();
});

it('retries a lost acceptance using its persisted key and validates the server public value', async () => {
  const { handshake } = await prepare();
  const { request, peer } = await peerFor(handshake);
  let snapshot, acceptance;
  await assert.rejects(
    peer.submit(
      async (method, params) => {
        acceptance = params;
        throw new Error('lost acceptance');
      },
      { save: async (state) => (snapshot = copy(state)) }
    ),
    /lost acceptance/
  );
  const restored = new protocol.SecretChatHandshake({ state: snapshot });
  await restored.submit(
    async (method, params) => {
      assert.equal(method, 'messages.acceptEncryption');
      assert.deepEqual(params, acceptance);
      return active(request, params, false);
    },
    { save: async () => {} }
  );
  assert.equal(restored.state.phase, 'ready');
  const wrongPublic = { ...active(request, acceptance, false) };
  wrongPublic.g_a_or_b = new Uint8Array(256).fill(1);
  let discarded = false;
  await assert.rejects(
    restored.apply(
      async (method) => {
        assert.equal(method, 'messages.discardEncryption');
        discarded = true;
      },
      wrongPublic,
      { save: async () => {} }
    ),
    /public value/i
  );
  assert.equal(discarded, true);
  assert.equal(restored.state.phase, 'discarded');
  const closed = new protocol.SecretChatHandshake({
    state: restored.exportState(),
  });
  assert.equal(closed.state.phase, 'discarded');
  peer.destroy();
  handshake.destroy();
});

it('rejects malformed portable handshake state before exposing private material', async () => {
  const { handshake } = await prepare();
  const state = handshake.exportState();
  for (const changes of [
    { version: 2 },
    { originator: 1 },
    { phase: 'ready' },
    { selfId: Number(alice) },
    { remoteId: String(alice) },
    { remoteId: '01' },
    { chatId: 0 },
    { chatId: 0x80000000 },
    { accessHash: '0' },
    { exchange: null },
    { publicValue: Buffer.alloc(256).toString('base64') },
    { publicValue: 'a'.repeat(348) },
    { user: '!!!!' },
    { key: Buffer.alloc(256).toString('base64') },
    { fingerprint: '1' },
    { dh: { p: '', g: 3 } },
    { dh: { p: state.dh.p, g: 2 } },
  ]) {
    assert.throws(
      () =>
        new protocol.SecretChatHandshake({ state: { ...state, ...changes } })
    );
  }
  const { peer } = await peerFor(handshake);
  const recipient = peer.exportState();
  for (const changes of [
    { phase: 'waiting' },
    { key: null },
    { fingerprint: String(BigInt(recipient.fingerprint) ^ 1n) },
    { accessHash: null },
    { remotePublic: '' },
    { user: state.user },
    { dh: { ...recipient.dh, g: 1 } },
  ]) {
    assert.throws(
      () =>
        new protocol.SecretChatHandshake({
          state: { ...recipient, ...changes },
        })
    );
  }
  handshake.destroy();
  peer.destroy();
});

it('negotiates through native encrypted TCP RPCs and consumes a real TL encryption update', async () => {
  let request, acceptance;
  const calls = [];
  const left = await secretRpcPeer((value) => {
    calls.push(value._);
    if (value._ === 'messages.getDhConfig') {
      return dhConfig();
    }
    assert.equal(value._, 'messages.requestEncryption');
    assert.deepEqual(value.user_id, user);
    request = value;
    return waiting(value.random_id);
  });
  let right;
  try {
    right = await secretRpcPeer((value) => {
      calls.push(value._);
      if (value._ === 'messages.getDhConfig') {
        return dhConfig();
      }
      assert.equal(value._, 'messages.acceptEncryption');
      acceptance = value;
      return active(request, value, false);
    });
    const invokeLeft = left.client.call.bind(left.client);
    const invokeRight = right.client.call.bind(right.client);
    const originator = await protocol.createSecretChatRequest(invokeLeft, {
      selfId: alice,
      user,
    });
    await originator.handshake.submit(invokeLeft, { save: async () => {} });
    const recipient = await protocol.createSecretChatAcceptance(invokeRight, {
      selfId: bob,
      chat: requested(request),
    });
    await recipient.handshake.submit(invokeRight, { save: async () => {} });
    left.client.onUpdate = async (update) => {
      assert.equal(update._, 'updateEncryption');
      await originator.handshake.apply(invokeLeft, update.chat, {
        save: async () => {},
      });
    };
    left.push({
      _: 'updateEncryption',
      chat: active(request, acceptance, true),
      date: 1,
    });
    await left.client.pollUpdates({ maxWait: 1000 });
    await left.client.drainUpdates();
    assert.deepEqual(
      originator.handshake.credentials().key,
      recipient.handshake.credentials().key
    );
    assert.deepEqual(calls, [
      'messages.getDhConfig',
      'messages.requestEncryption',
      'messages.getDhConfig',
      'messages.acceptEncryption',
    ]);
    originator.handshake.destroy();
    recipient.handshake.destroy();
  } finally {
    await right?.close();
    await left.close();
  }
});

it('discards malformed incoming public widths and preserves both protocol and discard failures', async () => {
  const { handshake } = await prepare();
  const { request, peer } = await peerFor(handshake);
  const error = new Error('discard transport failed');
  for (const g_a of [new Uint8Array(), new Uint8Array(257)]) {
    const methods = [];
    await assert.rejects(
      protocol.createSecretChatAcceptance(
        async (method) => {
          methods.push(method);
          throw error;
        },
        { selfId: bob, chat: { ...requested(request), g_a } }
      ),
      (failure) => {
        assert(failure instanceof globalThis.AggregateError);
        assert.match(failure.errors[0].message, /public value length/);
        assert.equal(failure.errors[1], error);
        return true;
      }
    );
    assert.deepEqual(methods, ['messages.discardEncryption']);
  }
  handshake.destroy();
  peer.destroy();
});
