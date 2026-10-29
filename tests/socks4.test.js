import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as protocol from '../src/mtproto.js';
import { serverFor } from './fixtures/tcp-server.js';
import { socksTunnel } from './fixtures/socks5-tunnel.js';
import {
  referenceWebSocketServer,
  localhostCa,
} from './fixtures/websocket-server.js';

async function proxyFor({
  reply = Buffer.from([0, 90, 0, 0, 0, 0, 0, 0]),
  welcome,
  silent = false,
} = {}) {
  const requests = [];
  const server = await serverFor((socket) => {
    let buffer = Buffer.alloc(0);
    let connected = false;
    let header = 4;
    socket.on('data', (bytes) => {
      buffer = Buffer.concat([buffer, bytes]);
      assert(buffer.length <= 4096, 'SOCKS4 fixture byte limit');
      if (!connected) {
        if (buffer.length < 9) {
          return;
        }
        const userEnd = buffer.indexOf(0, 8);
        if (userEnd < 0) {
          return;
        }
        const domain =
          buffer.subarray(4, 7).equals(Buffer.alloc(3)) && buffer[7] !== 0;
        const end = domain ? buffer.indexOf(0, userEnd + 1) : userEnd;
        if (end < 0) {
          return;
        }
        assert.deepEqual([...buffer.subarray(0, 2)], [4, 1]);
        requests.push(Buffer.from(buffer.subarray(0, end + 1)));
        buffer = buffer.subarray(end + 1);
        connected = true;
        if (!silent) {
          socket.write(reply.subarray(0, 3));
          socket.write(
            Buffer.concat([reply.subarray(3), welcome ?? Buffer.alloc(0)])
          );
        }
      }
      if (buffer.length < header) {
        return;
      }
      buffer = buffer.subarray(header);
      header = 0;
      if (buffer.length) {
        socket.write(buffer);
        buffer = Buffer.alloc(0);
      }
    });
  });
  return { ...server, requests };
}

it('negotiates SOCKS4 IPv4 and SOCKS4a proxy DNS with bounded UTF-8 user IDs', async () => {
  assert.equal(typeof protocol.createSocks4Connector, 'function');
  for (const [host, expected] of [
    ['149.154.167.51', '959aa73366c3b8c3b800'],
    [
      'telegram.invalid',
      `0000000166c3b8c3b800${Buffer.from('telegram.invalid').toString('hex')}00`,
    ],
    [
      'tést.invalid',
      `0000000166c3b8c3b800${Buffer.from('xn--tst-bma.invalid').toString('hex')}00`,
    ],
  ]) {
    const proxy = await proxyFor();
    const transport = new protocol.TcpTransport({
      host,
      proxy: {
        host: '127.0.0.1',
        port: proxy.port,
        socksType: 4,
        username: 'føø',
      },
      timeout: 1000,
    });
    try {
      const packet = Buffer.alloc(32, 42);
      assert.deepEqual(await transport.request(packet), packet);
      assert.equal(proxy.requests[0].toString('hex'), `040101bb${expected}`);
    } finally {
      transport.close();
      await proxy.close();
    }
  }
});

it('rejects SOCKS4 failure/version replies and preserves coalesced tunnel packets', async () => {
  assert.equal(typeof protocol.createSocks4Connector, 'function');
  for (const [version, status] of [
    [0, 91],
    [0, 92],
    [0, 93],
    [4, 90],
  ]) {
    const proxy = await proxyFor({
      reply: Buffer.from([version, status, 0, 0, 0, 0, 0, 0]),
    });
    const transport = new protocol.TcpTransport({
      host: 'telegram.invalid',
      proxy: { host: '127.0.0.1', port: proxy.port, type: 'socks4a' },
      timeout: 1000,
    });
    try {
      await assert.rejects(
        transport.request(Buffer.alloc(32)),
        (error) =>
          error.type === 'PROXY_ERROR' &&
          /SOCKS4/.test(error.message) &&
          (version !== 0 || error.code === status)
      );
    } finally {
      transport.close();
      await proxy.close();
    }
  }
  const writer = new protocol.TransportFraming();
  const packet = Buffer.alloc(32, 42);
  const proxy = await proxyFor({ welcome: writer.encode(packet) });
  const transport = new protocol.TcpTransport({
    host: 'telegram.invalid',
    proxy: { host: '127.0.0.1', port: proxy.port, type: 'socks4' },
    timeout: 1000,
  });
  try {
    await transport.connect();
    assert.deepEqual(await transport.receive(), packet);
  } finally {
    transport.close();
    await proxy.close();
  }
});

it('bounds SOCKS4 negotiation and rejects unsupported IPv6/password settings before connecting', async () => {
  assert.equal(typeof protocol.createSocks4Connector, 'function');
  for (const settings of [
    { password: 'not-supported' },
    { username: 'a\0b' },
    { username: 'a'.repeat(256) },
    { socksType: 5 },
    { type: 'socks5' },
    { secret: Buffer.alloc(16) },
  ]) {
    assert.throws(
      () => protocol.createSocks4Connector({ host: '127.0.0.1', ...settings }),
      /SOCKS4|proxy/i
    );
  }
  const connector = protocol.createSocks4Connector({ host: '127.0.0.1' });
  for (const host of ['::1', '0.0.0.1', 'bad/domain', 'x'.repeat(256)]) {
    assert.throws(() => connector({ host, port: 443 }), /SOCKS4|IPv6|domain/i);
  }
  const socks5 = protocol.createSocks5Connector({ host: '127.0.0.1' });
  assert.throws(() => socks5({ host: 'bad/domain', port: 443 }), /domain/i);
  const proxy = await proxyFor({ silent: true });
  const transport = new protocol.TcpTransport({
    host: 'telegram.invalid',
    proxy: { host: '127.0.0.1', port: proxy.port, socksType: 4 },
    timeout: 30,
  });
  try {
    await assert.rejects(transport.request(Buffer.alloc(32)), /timeout/i);
  } finally {
    transport.close();
    await proxy.close();
  }
});

it('carries TLS-verified obfuscated WebSocket packets through a SOCKS4a tunnel', async () => {
  const server = await referenceWebSocketServer({ secure: true });
  const tunnel = await socksTunnel(server.port, 4);
  const transport = new protocol.WebSocketTransport({
    url: `wss://localhost:${server.port}/apiws`,
    ca: localhostCa,
    proxy: { host: '127.0.0.1', port: tunnel.port, type: 'socks4a' },
    timeout: 2000,
  });
  try {
    const packet = Buffer.alloc(32, 42);
    assert.deepEqual(await transport.request(packet), packet);
    assert.deepEqual(tunnel.hosts, ['localhost']);
    assert.deepEqual(server.errors, []);
  } finally {
    transport.close();
    await tunnel.close();
    await server.close();
  }
});
