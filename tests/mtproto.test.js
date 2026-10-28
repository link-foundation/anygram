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
