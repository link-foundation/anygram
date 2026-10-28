import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { inspect } from 'node:util';
import * as protocol from '../src/mtproto.js';
import { serverFor } from './fixtures/tcp-server.js';
import { peerFor } from './fixtures/obfuscated-peer.js';

const secret = Buffer.alloc(16, 0x91);
const tags = {
  abridged: 0xefefefef,
  intermediate: 0xeeeeeeee,
  padded: 0xdddddddd,
};

function packet(value = 42) {
  const bytes = Buffer.alloc(52, value);
  bytes.fill(0, 0, 8);
  bytes.writeUInt32LE(32, 16);
  return bytes;
}

it('obfuscates three framing formats with independent continuous AES counters and MTProxy DC routing', () => {
  for (const mode of Object.keys(tags)) {
    for (const key of [
      undefined,
      secret,
      Buffer.concat([Buffer.from([0xdd]), secret]),
    ]) {
      const framing = new protocol.ObfuscatedFraming({
        mode,
        secret: key,
        dc: 4,
        test: true,
        media: true,
      });
      const header = framing.header;
      assert.equal(header.length, 64);
      const peer = peerFor(header, key && secret);
      assert.equal(peer.plain.readUInt32LE(56), tags[mode]);
      if (key) {
        assert.equal(peer.plain.readInt16LE(60), -10004);
      }
      const nativePeer = new protocol.TransportFraming({ mode });
      for (const value of [42, 43, 44]) {
        const body = packet(value);
        assert.deepEqual(
          nativePeer.push(peer.incoming.update(framing.encode(body))),
          [body]
        );
        const response = peer.outgoing.update(nativePeer.encode(body));
        const decoded = [];
        for (let offset = 0; offset < response.length; offset += 5) {
          decoded.push(...framing.push(response.subarray(offset, offset + 5)));
        }
        assert.deepEqual(decoded, [body]);
      }
      assert(!inspect(framing, { depth: 5 }).includes(secret.toString('hex')));
    }
  }
});

it('bounds initialization attempts and rejects invalid secrets before opening sockets', () => {
  let attempts = 0;
  assert.throws(
    () =>
      new protocol.ObfuscatedFraming({
        random: (n) => {
          attempts++;
          return Buffer.alloc(n);
        },
      }),
    /initialization|random/i
  );
  assert.equal(attempts, 64);
  for (const prefix of [
    'dddddddd',
    'eeeeeeee',
    '504f5354',
    '47455420',
    '48454144',
    '4f505449',
    '16030102',
    'ef010203',
  ]) {
    let draws = 0;
    const framing = new protocol.ObfuscatedFraming({
      random: (n) => {
        draws++;
        const bytes = Buffer.alloc(n, 42);
        if (draws === 1) {
          Buffer.from(prefix, 'hex').copy(bytes);
        }
        return bytes;
      },
    });
    assert.equal(draws, 2);
    assert.equal(framing.header[0], 42);
  }
  for (const bad of [
    'wrong-secret',
    'a'.repeat(31),
    Buffer.alloc(15),
    Buffer.alloc(18),
  ]) {
    assert.throws(
      () => new protocol.ObfuscatedFraming({ secret: bad, dc: 2 }),
      /secret/i
    );
  }
  assert.throws(
    () => new protocol.ObfuscatedFraming({ secret, dc: 0 }),
    /DC|data center/i
  );
  assert.throws(
    () => new protocol.ObfuscatedFraming({ random: () => Buffer.alloc(3) }),
    /random|64/i
  );
});

it('matches the actual GramJS obfuscated and MTProxy headers and subsequent packets', async () => {
  await import('telegram');
  const { ConnectionTCPObfuscated } =
    await import('telegram/network/connection/TCPObfuscated.js');
  const { ConnectionTCPMTProxyAbridged } =
    await import('telegram/network/connection/TCPMTProxy.js');
  for (const [Reference, key] of [
    [ConnectionTCPObfuscated, undefined],
    [ConnectionTCPMTProxyAbridged, secret],
  ]) {
    const writes = [];
    class Socket {
      write(bytes) {
        writes.push(Buffer.from(bytes));
      }
    }
    const connection = new Reference({
      dcId: 4,
      proxy: {
        MTProxy: true,
        ip: '127.0.0.1',
        port: 443,
        secret: secret.toString('hex'),
      },
      socket: Socket,
    });
    await connection._initConn();
    const peer = peerFor(writes[0], key);
    const native = new protocol.ObfuscatedFraming({
      mode: 'abridged',
      secret: key,
      dc: 4,
      random: () => peer.plain,
    });
    assert.deepEqual(native.header, writes[0]);
    const referenceCodec = new connection.PacketCodecClass(connection);
    for (const value of [42, 43, 44]) {
      connection._obfuscation.write(referenceCodec.encodePacket(packet(value)));
      assert.deepEqual(native.encode(packet(value)), writes.at(-1));
    }
  }
});

async function obfuscatedServer(mode, key) {
  const headers = [];
  const server = await serverFor((socket) => {
    let pending = Buffer.alloc(0);
    let peer;
    const framing = new protocol.TransportFraming({ mode });
    socket.on('data', (bytes) => {
      pending = Buffer.concat([pending, bytes]);
      assert(pending.length <= 4096, 'Fixture byte limit');
      if (!peer) {
        if (pending.length < 64) {
          return;
        }
        peer = peerFor(pending.subarray(0, 64), key);
        headers.push(peer.plain);
        assert.equal(peer.plain.readUInt32LE(56), tags[mode]);
        pending = pending.subarray(64);
      }
      for (const body of framing.push(peer.incoming.update(pending))) {
        const response = peer.outgoing.update(framing.encode(body));
        socket.write(response.subarray(0, 3));
        socket.write(response.subarray(3));
      }
      pending = Buffer.alloc(0);
    });
  });
  return { ...server, headers };
}

it('uses obfuscated native TCP and routes MTProxy connections to the proxy endpoint', async () => {
  for (const [mode, useProxy] of [
    ['abridged', false],
    ['intermediate', false],
    ['padded', false],
    ['padded', true],
  ]) {
    const server = await obfuscatedServer(mode, useProxy ? secret : undefined);
    const options = useProxy
      ? {
          host: 'telegram.invalid',
          dc: 4,
          test: true,
          media: true,
          proxy: {
            MTProxy: true,
            host: '127.0.0.1',
            port: server.port,
            secret: `dd${secret.toString('hex')}`,
          },
        }
      : { host: '127.0.0.1', port: server.port, mode, obfuscate: true };
    const transport = new protocol.TcpTransport({ ...options, timeout: 1000 });
    try {
      for (const value of [42, 43]) {
        assert.deepEqual(await transport.request(packet(value)), packet(value));
      }
      assert.equal(server.headers.length, 1);
      if (useProxy) {
        assert.equal(server.headers[0].readInt16LE(60), -10004);
      }
      assert(
        !inspect(transport, { depth: 5 }).includes(secret.toString('hex'))
      );
    } finally {
      transport.close();
      await server.close();
    }
  }
});

it('selects TCP for obfuscation and validates MTProxy options before connecting', async () => {
  const client = new protocol.Mtproto({ obfuscate: true });
  assert(client.transport instanceof protocol.TcpTransport);
  await client.disconnect();
  for (const proxy of [
    { MTProxy: true, host: '127.0.0.1', port: 443 },
    { MTProxy: true, host: '127.0.0.1', port: 0, secret },
    { MTProxy: true, host: '127.0.0.1', secret: 'invalid-secret' },
  ]) {
    assert.throws(
      () => new protocol.TcpTransport({ proxy }),
      /secret|endpoint/i
    );
  }
  assert.throws(
    () =>
      new protocol.TcpTransport({
        proxy: { MTProxy: true, host: '127.0.0.1', secret },
        connectSocket: () => {},
      }),
    /either|connector/i
  );
  assert.throws(
    () => new protocol.TcpTransport({ proxy: { host: '127.0.0.1', secret } }),
    /type|MTProxy/i
  );
  for (const encoding of [
    secret.toString('hex'),
    secret.toString('base64'),
    secret.toString('base64url'),
  ]) {
    assert.equal(
      new protocol.ObfuscatedFraming({ secret: encoding }).header.length,
      64
    );
  }
});
