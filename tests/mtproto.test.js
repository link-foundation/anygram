import { describe, it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { Mtproto } from '../src/mtproto.js';
import { factorize, rsaKey } from '../src/auth-key.js';
import { productionKey } from '../src/server-keys.js';
import { gzipSync } from 'node:zlib';
import { TlWriter } from '../src/tl.js';

function serverFor(reply) {
  let serverId = (BigInt(Math.floor(Date.now() / 1000)) << 32n) + 1n;
  const client = new Mtproto({
    authKey: randomBytes(256),
    transport: {
      request: async (packet) => {
        const request = client.cipher.decrypt(packet, { server: false });
        if (client.codec.decode(request.body)._ === 'msgs_ack') {
          client.lastAcknowledgement = client.codec.decode(request.body);
          serverId += 4n;
          return client.cipher.encrypt(
            client.codec.encode({ _: 'msgs_ack', msg_ids: [] }),
            { messageId: serverId, server: true }
          );
        }
        const result = await reply(client, request);
        serverId += 4n;
        return client.cipher.encrypt(result, {
          messageId: serverId,
          server: true,
          sequence: 1,
        });
      },
    },
  });
  return client;
}

const rpcResult = (id, data) => {
  const header = Buffer.alloc(12);
  header.writeUInt32LE(0xf35c6d01);
  header.writeBigInt64LE(id, 4);
  return Buffer.concat([header, data]);
};

it('decodes nested generic RPC results using the inner vector type', async () => {
  const client = serverFor((client, envelope) => {
    const request = client.codec.decode(envelope.body);
    assert.equal(request._, 'invokeAfterMsgs');
    assert.equal(request.query._, 'invokeWithoutUpdates');
    assert.equal(request.query.query._, 'contacts.getContactIDs');
    return rpcResult(
      envelope.messageId,
      client.codec.encode([1, -2, 3], 'Vector<int>')
    );
  });
  assert.deepEqual(
    await client.invoke({
      _: 'invokeAfterMsgs',
      msg_ids: [4n],
      query: {
        _: 'invokeWithoutUpdates',
        query: { _: 'contacts.getContactIDs', hash: 0n },
      },
    }),
    [1, -2, 3]
  );
});

it('returns the successful RPC message receipt and chains the next request before initialization', async () => {
  const received = [];
  const client = serverFor((client, envelope) => {
    let request = client.codec.decode(envelope.body);
    while (['invokeWithLayer', 'initConnection'].includes(request._)) {
      request = request.query;
    }
    received.push({ request, messageId: envelope.messageId });
    return rpcResult(
      envelope.messageId,
      client.codec.encode([11n, 12n], 'Vector<long>')
    );
  });
  client.apiId = 777;
  const first = await client.callWithReceipt('messages.receivedQueue', {
    max_qts: 1,
  });
  assert.deepEqual(first, {
    value: [11n, 12n],
    messageId: received[0].messageId,
    dc: 2,
  });
  client.initialized = false;
  const dependencies = [first.messageId];
  const next = client.callWithReceipt(
    'messages.receivedQueue',
    { max_qts: 2 },
    { afterMessageIds: dependencies }
  );
  dependencies[0] = 4n;
  const second = await next;
  assert.deepEqual(received[1].request, {
    _: 'invokeAfterMsgs',
    msg_ids: [first.messageId],
    query: { _: 'messages.receivedQueue', max_qts: 2 },
  });
  assert.equal(second.messageId, received[1].messageId);
  assert.ok(second.messageId > first.messageId);
});

it('bounds dependency IDs and generic query depth before any network activity', async () => {
  const client = serverFor(() => assert.fail('Invalid RPC was transmitted'));
  for (const ids of [
    null,
    '4',
    [0n],
    [-4n],
    [1n],
    [4],
    [1n << 63n],
    [4n, 4n],
    new Array(1),
    Array.from({ length: 1001 }, (_, index) => BigInt(index + 1) * 4n),
  ]) {
    await assert.rejects(
      client.callWithReceipt('help.getConfig', {}, { afterMessageIds: ids }),
      /dependency/i
    );
  }
  for (const query of [undefined, { _: 'inputPeerSelf' }]) {
    await assert.rejects(
      client.rpc({ _: 'invokeWithoutUpdates', query }),
      /Unknown Telegram RPC/
    );
  }
  client.codec.maxDepth = 4;
  const cyclic = { _: 'invokeWithoutUpdates' };
  cyclic.query = cyclic;
  await assert.rejects(client.rpc(cyclic), /query depth/);
});

it('returns the accepted salt-retry receipt and preserves RPC errors', async () => {
  const ids = [];
  const client = serverFor((client, envelope) => {
    ids.push(envelope.messageId);
    if (ids.length === 1) {
      return client.codec.encode({
        _: 'bad_server_salt',
        bad_msg_id: envelope.messageId,
        bad_msg_seqno: envelope.sequence,
        error_code: 48,
        new_server_salt: 12n,
      });
    }
    return rpcResult(
      envelope.messageId,
      client.codec.encode(
        ids.length === 2
          ? true
          : { _: 'rpc_error', error_code: 420, error_message: 'FLOOD_WAIT_17' },
        ids.length === 2 ? 'Bool' : 'Object'
      )
    );
  });
  const receipt = await client.callWithReceipt('account.updateStatus', {
    offline: false,
  });
  assert.equal(receipt.messageId, ids[1]);
  assert.notEqual(receipt.messageId, ids[0]);
  assert.equal(receipt.value, true);
  await assert.rejects(
    client.callWithReceipt('account.updateStatus', { offline: false }),
    (error) => error.code === 420 && error.retryAfter === 17
  );
  assert.equal(ids.length, 3);
});

it('reports a migrated receipt and removes dependencies from destination authorization RPCs', async () => {
  const dependencies = [4n];
  const home = serverFor((client, envelope) => {
    const request = client.codec.decode(envelope.body);
    if (request._ === 'auth.exportAuthorization') {
      return rpcResult(
        envelope.messageId,
        client.codec.encode({
          _: 'auth.exportedAuthorization',
          id: 1n,
          bytes: new Uint8Array(1),
        })
      );
    }
    assert.equal(request._, 'invokeAfterMsgs');
    assert.deepEqual(request.msg_ids, dependencies);
    return rpcResult(
      envelope.messageId,
      client.codec.encode({
        _: 'rpc_error',
        error_code: 303,
        error_message: 'USER_MIGRATE_4',
      })
    );
  });
  const destination = [];
  const next = serverFor((client, envelope) => {
    const request = client.codec.decode(envelope.body);
    destination.push({ request, messageId: envelope.messageId });
    return rpcResult(
      envelope.messageId,
      client.codec.encode(
        request._ === 'auth.importAuthorization'
          ? { _: 'auth.authorization', user: { _: 'userEmpty', id: 1n } }
          : true,
        request._ === 'auth.importAuthorization' ? 'Object' : 'Bool'
      )
    );
  });
  next.dc = 4;
  home.datacenters.create = () => next;
  const receipt = await home.callWithReceipt(
    'account.updateStatus',
    { offline: true },
    { afterMessageIds: dependencies }
  );
  assert.deepEqual(
    destination.map(({ request }) => request._),
    ['auth.importAuthorization', 'account.updateStatus']
  );
  assert.deepEqual(receipt, {
    value: true,
    messageId: destination[1].messageId,
    dc: 4,
  });
});

describe('native MTProto session', () => {
  it('dispatches encrypted raw RPCs with exact request/result correlation', async () => {
    const client = serverFor((client, request) => {
      assert.equal(client.codec.decode(request.body)._, 'account.updateStatus');
      return rpcResult(request.messageId, client.codec.encode(true, 'Bool'));
    });
    assert.equal(
      await client.call('account.updateStatus', { offline: true }),
      true
    );
    assert.equal(client.lastAcknowledgement.msg_ids.length, 1);
  });

  it('only retries sends explicitly rejected for a bad server salt', async () => {
    let attempts = 0;
    const client = serverFor((client, request) => {
      if (attempts++ === 0) {
        return client.codec.encode({
          _: 'bad_server_salt',
          bad_msg_id: request.messageId,
          bad_msg_seqno: request.sequence,
          error_code: 48,
          new_server_salt: 12n,
        });
      }
      assert.equal(request.salt, 12n);
      return rpcResult(request.messageId, client.codec.encode(true, 'Bool'));
    });
    assert.equal(
      await client.call('account.updateStatus', { offline: true }),
      true
    );
    assert.equal(attempts, 2);
  });

  it('preserves typed RPC failures without an implicit retry', async () => {
    let attempts = 0;
    const client = serverFor((client, request) => {
      attempts++;
      return rpcResult(
        request.messageId,
        client.codec.encode({
          _: 'rpc_error',
          error_code: 420,
          error_message: 'FLOOD_WAIT_17',
        })
      );
    });
    await assert.rejects(
      client.call('account.updateStatus', { offline: true }),
      (error) => error.code === 420 && error.retryAfter === 17
    );
    assert.equal(attempts, 1);
  });

  it('rejects duplicate and out-of-window server messages', () => {
    const client = serverFor(() => assert.fail());
    const id = (BigInt(Math.floor(Date.now() / 1000)) << 32n) + 1n;
    assert.equal(client.acceptId(id), true);
    assert.equal(client.acceptId(id), false);
    assert.throws(() => client.acceptId(id + (301n << 32n)), /message ID/);
  });

  it('does not transmit a request cancelled while waiting for the queue', async () => {
    const client = serverFor(() =>
      assert.fail('Cancelled request was transmitted')
    );
    const controller = new globalThis.AbortController();
    controller.abort();
    await assert.rejects(
      client.call('help.getConfig', {}, { signal: controller.signal }),
      /abort|cancel/i
    );
  });

  it('uses the official RSA trust anchor and finite factorization', () => {
    assert.equal(rsaKey(productionKey).fingerprint, -3414540481677951611n);
    assert.deepEqual(factorize(1000000007n * 1000000009n), [
      1000000007n,
      1000000009n,
    ]);
    assert.throws(() => factorize(1n << 100n), /pq/);
  });

  it('bounds recursively compressed RPC results', () => {
    const client = serverFor(() => assert.fail());
    client.codec.maxDepth = 3;
    let bytes = client.codec.encode(true, 'Bool');
    for (let i = 0; i < 5; i++) {
      const writer = new TlWriter(client.codec);
      writer.number(0x3072cfa1, 4, 'setUint32');
      writer.bytes(gzipSync(bytes));
      bytes = writer.finish();
    }
    assert.throws(() => client.readResult(bytes, 'Bool'), /depth/i);
  });
});
it('allows update handlers to make RPCs without holding the transport queue', async () => {
  let calls = 0;
  let originalId;
  const client = serverFor((client, request) => {
    calls++;
    if (calls === 1) {
      originalId = request.messageId;
      return client.codec.encode({
        _: 'new_session_created',
        first_msg_id: request.messageId,
        unique_id: 1n,
        server_salt: 2n,
      });
    }
    return rpcResult(
      calls === 2 ? originalId : request.messageId,
      client.codec.encode(true, 'Bool')
    );
  });
  let replied = false;
  client.onUpdate = async () => {
    await client.call('account.updateStatus', { offline: false });
    replied = true;
  };
  await client.call('account.updateStatus', { offline: true });
  await client.updateQueue;
  assert.equal(replied, true);
  assert.equal(client.updateError, undefined);
});
it('follows an encrypted phone migration and exports the migrated session', async () => {
  const home = serverFor((client, request) =>
    rpcResult(
      request.messageId,
      client.codec.encode({
        _: 'rpc_error',
        error_code: 303,
        error_message: 'PHONE_MIGRATE_4',
      })
    )
  );
  const next = serverFor((client, request) =>
    rpcResult(
      request.messageId,
      client.codec.encode({
        _: 'auth.sentCode',
        type: { _: 'auth.sentCodeTypeApp', length: 5 },
        phone_code_hash: 'hash',
      })
    )
  );
  next.dc = 4;
  home.datacenters.create = () => next;
  const code = await home.call('auth.sendCode', {
    phone_number: '+123',
    api_id: 1,
    api_hash: 'hash',
    settings: { _: 'codeSettings' },
  });
  assert.equal(code.phone_code_hash, 'hash');
  assert.equal(home.datacenters.home.dc, 4);
  const { Session } = await import('../src/session.js');
  assert.equal(new Session(home.saveSession()).options().dc, 4);
});
it('runs a finite updates loop and stops only after its handler finishes', async () => {
  const client = new Mtproto({ authKey: randomBytes(256) });
  client.call = async () => ({ pts: 1, qts: 0, seq: 0, date: 1 });
  client.pollUpdates = async () => {
    client.pendingUpdates.push({
      _: 'updateShort',
      update: {
        _: 'updateNewMessage',
        message: { id: 2 },
        pts: 2,
        pts_count: 1,
      },
    });
    client.dispatchUpdates();
  };
  let completed = false;
  const state = await client.runUpdates({
    maxPolls: 1,
    onUpdate: async () => {
      await Promise.resolve();
      completed = true;
    },
  });
  assert.equal(completed, true);
  assert.equal(state.pts, 2);
  assert.equal(client.updatesController, undefined);
});
it('runs scheduled differences inside the update loop and releases watched-channel state on exit', async () => {
  const client = new Mtproto({ authKey: randomBytes(256) });
  const calls = [];
  client.call = async (method, params) => {
    calls.push(method);
    if (method === 'updates.getDifference') {
      return { _: 'updates.differenceEmpty', date: 2, seq: 0 };
    }
    assert.equal(method, 'updates.getChannelDifference');
    assert.equal(params.channel.channel_id, 42n);
    return {
      _: 'updates.channelDifferenceEmpty',
      pts: 1,
      final: true,
      timeout: 30,
    };
  };
  client.pollUpdates = async () => {
    client.unwatchChannel(42n);
  };
  assert.throws(() => client.watchChannel(42n), /Start update recovery/);
  await client.runUpdates({
    maxPolls: 1,
    watchedChannels: [42n],
    state: { date: 1, channels: { 42: { pts: 1, access_hash: 7n } } },
  });
  assert.deepEqual(calls, [
    'updates.getDifference',
    'updates.getChannelDifference',
  ]);
  assert.equal(client.updateManager, undefined);
});
