import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import * as protocol from '../src/mtproto.js';
import { peerFor } from './fixtures/obfuscated-peer.js';
import { serverFor } from './fixtures/tcp-server.js';
import {
  localhostCa,
  referenceWebSocketServer,
} from './fixtures/websocket-server.js';
import { socks5Tunnel } from './fixtures/socks5-tunnel.js';

it('encodes masked WebSocket lengths and incrementally decodes binary frames', () => {
  for (const length of [0, 1, 125, 126, 65535, 65536]) {
    const payload = Buffer.alloc(length, 42);
    const client = new protocol.WebSocketFraming({ client: true });
    const server = new protocol.WebSocketFraming({ client: false });
    const encoded = client.encode(payload);
    assert(encoded[1] & 128);
    const frames = [];
    for (let offset = 0; offset < encoded.length; offset += 4093) {
      frames.push(...server.push(encoded.subarray(offset, offset + 4093)));
    }
    assert.deepEqual(frames, [{ opcode: 2, final: true, payload }]);
    assert.deepEqual(client.push(server.encode(payload)), frames);
  }
  const server = new protocol.WebSocketFraming({ client: false });
  assert.equal(
    server.encode(Buffer.from([1, 2, 3, 4, 5])).toString('hex'),
    '82050102030405'
  );
});

it('handles continuation/control frames and rejects invalid or oversized WebSocket headers', () => {
  const server = new protocol.WebSocketFraming({ client: false });
  const wire = Buffer.concat([
    server.encode(Buffer.from('a'), { final: false }),
    server.encode(Buffer.from('ping'), { opcode: 9 }),
    server.encode(Buffer.from('b'), { opcode: 0 }),
    server.encode(Buffer.alloc(0), { opcode: 10 }),
  ]);
  const frames = new protocol.WebSocketFraming().push(wire);
  assert.deepEqual(
    frames.map((f) => [f.opcode, f.final, f.payload.toString()]),
    [
      [2, false, 'a'],
      [9, true, 'ping'],
      [0, true, 'b'],
      [10, true, ''],
    ]
  );
  for (const bytes of [
    [0x82, 0x80],
    [0xc2, 0],
    [0x81, 0],
    [0x83, 0],
    [0x80, 0],
    [0x09, 0],
    [0x89, 126, 0, 126],
    [0x82, 126, 0, 1],
    [0x82, 127, 0x80, 0, 0, 0, 0, 0, 0, 0],
  ]) {
    assert.throws(
      () =>
        new protocol.WebSocketFraming({ maxBytes: 64 }).push(
          Buffer.from(bytes)
        ),
      /WebSocket|limit/i
    );
  }
  assert.throws(
    () =>
      new protocol.WebSocketFraming({ maxBytes: 64 }).push(Buffer.alloc(200)),
    /limit/i
  );
  const limited = new protocol.WebSocketFraming({ maxBytes: 64 });
  assert.throws(
    () =>
      limited.push(
        Buffer.concat([
          server.encode(Buffer.alloc(40), { final: false }),
          server.encode(Buffer.alloc(40), { opcode: 0 }),
        ])
      ),
    /limit/i
  );
  assert.throws(
    () =>
      new protocol.WebSocketFraming({ maxFrames: 1 }).push(
        Buffer.concat([
          server.encode(Buffer.alloc(0)),
          server.encode(Buffer.alloc(0)),
        ])
      ),
    /limit/i
  );
});

async function websocketServer({
  invalid,
  silent = false,
  closeCode,
  closePayload,
} = {}) {
  const trace = { headers: [], pongs: [], errors: [] };
  const server = await serverFor((socket) => {
    const ws = new protocol.WebSocketFraming({ client: false });
    const framing = new protocol.TransportFraming();
    let buffer = Buffer.alloc(0);
    let upgraded = false;
    let peer;
    let stream = Buffer.alloc(0);
    function acceptFrame(frame) {
      if (frame.opcode === 10) {
        trace.pongs.push(frame.payload.toString());
        return;
      }
      if (frame.opcode === 8) {
        socket.end();
        return;
      }
      stream = Buffer.concat([stream, frame.payload]);
      if (!peer) {
        if (stream.length < 64) {
          return;
        }
        peer = peerFor(stream.subarray(0, 64));
        assert.equal(peer.plain.readUInt32LE(56), 0xeeeeeeee);
        stream = stream.subarray(64);
      }
      for (const body of framing.push(peer.incoming.update(stream))) {
        if (closeCode || closePayload) {
          const close =
            closePayload ??
            Buffer.concat([
              Buffer.from([3, 232]),
              Buffer.from(` ${closeCode} `),
            ]);
          socket.write(ws.encode(close, { opcode: 8 }));
        } else {
          const response = peer.outgoing.update(framing.encode(body));
          const bytes = Buffer.concat([
            ws.encode(response.subarray(0, 5), { final: false }),
            ws.encode(Buffer.from('alive'), { opcode: 9 }),
            ws.encode(response.subarray(5), { opcode: 0 }),
          ]);
          socket.write(bytes.subarray(0, 3));
          socket.write(bytes.subarray(3));
        }
      }
      stream = Buffer.alloc(0);
    }
    socket.on('data', (bytes) => {
      try {
        if (!upgraded) {
          buffer = Buffer.concat([buffer, bytes]);
          assert(buffer.length <= 8192, 'Handshake fixture limit');
          const end = buffer.indexOf('\r\n\r\n');
          if (end < 0) {
            return;
          }
          const text = buffer.subarray(0, end).toString();
          trace.headers.push(text);
          assert.match(text, /^GET \/apiws HTTP\/1.1/);
          assert.match(text, /Sec-WebSocket-Protocol: binary/i);
          const key = /Sec-WebSocket-Key: ([^\r\n]+)/i.exec(text)[1];
          const accept = createHash('sha1')
            .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
            .digest('base64');
          upgraded = true;
          if (!silent) {
            socket.write(
              `HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${invalid === 'accept' ? 'invalid' : accept}\r\nSec-WebSocket-Protocol: ${invalid === 'protocol' ? 'text' : 'binary'}\r\n${invalid === 'extension' ? 'Sec-WebSocket-Extensions: permessage-deflate\r\n' : ''}\r\n`
            );
          }
          bytes = buffer.subarray(end + 4);
          buffer = Buffer.alloc(0);
        }
        for (const frame of ws.push(bytes)) {
          acceptFrame(frame);
        }
      } catch (error) {
        trace.errors.push(error);
        socket.destroy();
      }
    });
  });
  return { ...server, trace, url: `ws://127.0.0.1:${server.port}/apiws` };
}

it('streams obfuscated Telegram packets across fragmented binary WebSocket messages and answers pings', async () => {
  assert.equal(typeof protocol.WebSocketTransport, 'function');
  const server = await websocketServer();
  const transport = new protocol.WebSocketTransport({
    url: server.url,
    timeout: 1000,
  });
  try {
    for (const size of [52, 1024]) {
      assert.deepEqual(
        await transport.request(Buffer.alloc(size, 42)),
        Buffer.alloc(size, 42)
      );
    }
    assert.equal(server.trace.headers.length, 1);
    assert.equal(server.trace.pongs[0], 'alive');
  } finally {
    transport.close();
    await server.close();
  }
  assert.deepEqual(server.trace.errors, []);
});

it('validates WebSocket upgrade responses and includes negotiation in cancellation/deadlines', async () => {
  assert.equal(typeof protocol.WebSocketTransport, 'function');
  for (const options of [
    { invalid: 'accept' },
    { invalid: 'protocol' },
    { invalid: 'extension' },
    { silent: true },
  ]) {
    const server = await websocketServer(options);
    const transport = new protocol.WebSocketTransport({
      url: server.url,
      timeout: options.silent ? 30 : 1000,
    });
    try {
      await assert.rejects(
        transport.request(Buffer.alloc(32)),
        /WebSocket|timeout/i
      );
    } finally {
      transport.close();
      await server.close();
    }
    assert.deepEqual(server.trace.errors, []);
  }
  const server = await websocketServer({ silent: true });
  const transport = new protocol.WebSocketTransport({
    url: server.url,
    timeout: 1000,
  });
  const controller = new globalThis.AbortController();
  try {
    const pending = transport.request(Buffer.alloc(32), {
      signal: controller.signal,
    });
    controller.abort();
    await assert.rejects(pending, /abort/i);
  } finally {
    transport.close();
    await server.close();
  }
  for (const url of [
    'http://127.0.0.1/apiws',
    'ws://user:password@127.0.0.1/apiws',
    'ws://127.0.0.1/apiws#fragment',
  ]) {
    assert.throws(
      () => new protocol.WebSocketTransport({ url }),
      /WebSocket|URL/i
    );
  }
});

it('decodes Telegram WebSocket close reasons and supports native factory selection', async () => {
  assert.equal(typeof protocol.WebSocketTransport, 'function');
  const server = await websocketServer({ closeCode: -404 });
  const transport = new protocol.WebSocketTransport({
    url: server.url,
    timeout: 1000,
  });
  try {
    await assert.rejects(
      transport.request(Buffer.alloc(32)),
      (error) => error.code === 404 && error.type === 'TRANSPORT_ERROR'
    );
  } finally {
    transport.close();
    await server.close();
  }
  const client = new protocol.Mtproto({ transport: 'websocket' });
  assert(client.transport instanceof protocol.WebSocketTransport);
  await client.disconnect();
});

it('interoperates with an independent WebSocket server for masked large and fragmented messages', async () => {
  const server = await referenceWebSocketServer();
  const transport = new protocol.WebSocketTransport({
    url: server.url,
    timeout: 2000,
  });
  try {
    for (const size of [32, 128, 65536]) {
      const packet = Buffer.alloc(size, 42);
      assert.deepEqual(await transport.request(packet), packet);
    }
  } finally {
    transport.close();
    await server.close();
  }
  assert.deepEqual(server.errors, []);
});

it('rejects invalid WebSocket close status, truncated payload and non-UTF-8 reason', async () => {
  for (const closePayload of [
    Buffer.from([3]),
    Buffer.from([3, 231]),
    Buffer.from([3, 237]),
    Buffer.from([3, 232, 0xff]),
  ]) {
    const server = await websocketServer({ closePayload });
    const transport = new protocol.WebSocketTransport({
      url: server.url,
      timeout: 1000,
    });
    try {
      await assert.rejects(
        transport.request(Buffer.alloc(32)),
        (error) =>
          error.type === 'TRANSPORT_ERROR' && /WebSocket/.test(error.message)
      );
    } finally {
      transport.close();
      await server.close();
    }
    assert.deepEqual(server.trace.errors, []);
  }
});

it('validates TLS trust and hostname through direct and SOCKS5 WebSocket connections', async () => {
  const server = await referenceWebSocketServer({ secure: true });
  const tunnel = await socks5Tunnel(server.port);
  const proxy = { host: '127.0.0.1', port: tunnel.port };
  try {
    for (const options of [
      { url: server.url, error: /certificate|self.signed|issuer/i },
      { url: server.url, ca: localhostCa },
      { url: server.url, ca: localhostCa, proxy },
      {
        url: `wss://wrong.invalid:${server.port}/apiws`,
        ca: localhostCa,
        proxy,
        error: /hostname|altname|certificate.*name/i,
      },
    ]) {
      const transport = new protocol.WebSocketTransport({
        ...options,
        timeout: 2000,
      });
      try {
        const response = transport.request(Buffer.alloc(32, 42));
        if (options.error) {
          await assert.rejects(response, options.error);
        } else {
          assert.deepEqual(await response, Buffer.alloc(32, 42));
        }
      } finally {
        transport.close();
      }
    }
    assert.deepEqual(tunnel.hosts, ['127.0.0.1', 'wrong.invalid']);
  } finally {
    await tunnel.close();
    await server.close();
  }
  assert.deepEqual(server.errors, []);
});
