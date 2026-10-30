import { Mtproto } from '../src/mtproto.js';
import { framedServerFor } from '../tests/fixtures/tcp-server.js';

// Finite local encrypted RPC peer for secret-chat integration experiments.
// Application authorization and Telegram production behavior need live accounts.
export async function secretRpcPeer(handle) {
  let reply;
  let count = 0;
  let serverId = (BigInt(Math.floor(Date.now() / 1000)) << 32n) + 1n;
  const send = (body) => {
    if (!reply) {
      throw new Error('RPC peer has no connected client');
    }
    serverId += 4n;
    reply(
      client.cipher.encrypt(body, {
        server: true,
        messageId: serverId,
        sequence: 1,
      })
    );
  };
  const server = await framedServerFor('full', (packet, respond) => {
    reply = respond;
    const envelope = client.cipher.decrypt(packet, { server: false });
    let request = client.codec.decode(envelope.body);
    if (request._ === 'msgs_ack') {
      return;
    }
    let dependencies = [];
    while (
      ['invokeWithLayer', 'initConnection', 'invokeAfterMsgs'].includes(
        request._
      )
    ) {
      if (request._ === 'invokeAfterMsgs') {
        dependencies = request.msg_ids;
      }
      request = request.query;
    }
    if (++count > 20) {
      throw new RangeError('Local secret-chat peer RPC limit exceeded');
    }
    const response = handle(request, {
      messageId: envelope.messageId,
      afterMessageIds: dependencies,
    });
    const result = Buffer.alloc(12);
    result.writeUInt32LE(0xf35c6d01);
    result.writeBigInt64LE(envelope.messageId, 4);
    send(
      Buffer.concat([
        result,
        client.codec.encode(
          response,
          response?._ === 'rpc_error'
            ? 'Object'
            : client.codec.methods.get(request._).type
        ),
      ])
    );
  });
  const client = new Mtproto({
    apiId: 777,
    authKey: Buffer.alloc(256, 42),
    transport: 'tcp',
    mode: 'full',
    host: '127.0.0.1',
    port: server.port,
    timeout: 5000,
    maxBytes: 16384,
    maxQueuedBytes: 32768,
    maxPackets: 10,
  });
  return {
    client,
    push: (value) => send(client.codec.encode(value)),
    close: async () => {
      try {
        await client.disconnect();
      } finally {
        await server.close();
      }
    },
  };
}
