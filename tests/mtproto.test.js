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
