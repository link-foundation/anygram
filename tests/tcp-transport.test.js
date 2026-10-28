import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { createServer } from 'node:net';
import * as protocol from '../src/mtproto.js';

async function serverFor(handler) {
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
    handler(socket);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    port: server.address().port,
    close: async () => {
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

async function framedServerFor(mode, handle) {
  const headers = [];
  const server = await serverFor((socket) => {
    const framing = new protocol.TransportFraming({ mode });
    const headerLength = framing.header.length;
    let pending = Buffer.alloc(0);
    let initialized = false;
    socket.on('data', (bytes) => {
      pending = Buffer.concat([pending, bytes]);
      if (!initialized) {
        if (pending.length < headerLength) {
          return;
        }
        headers.push(Buffer.from(pending.subarray(0, headerLength)));
        pending = pending.subarray(headerLength);
        initialized = true;
      }
      for (const packet of framing.push(pending)) {
        handle(packet, (body) => {
          const reply = framing.encode(body);
          socket.write(reply.subarray(0, 3));
          socket.write(reply.subarray(3));
        });
      }
      pending = Buffer.alloc(0);
    });
  });
  return { ...server, headers };
}

it('exchanges framed packets over real TCP with fragmentation in every mode', async () => {
  assert.equal(typeof protocol.TcpTransport, 'function');
  for (const mode of ['abridged', 'intermediate', 'padded', 'full']) {
    const server = await framedServerFor(mode, (packet, reply) =>
      reply(packet)
    );
    const transport = new protocol.TcpTransport({
      host: '127.0.0.1',
      port: server.port,
      mode,
      timeout: 1000,
    });
    try {
      const packet = Buffer.alloc(52);
      packet.writeInt32LE(32, 16);
      packet.fill(42, 20);
      assert.deepEqual(await transport.request(packet), packet);
      assert.deepEqual(await transport.request(packet), packet);
      assert.deepEqual(
        server.headers[0],
        new protocol.TransportFraming({ mode }).header
      );
    } finally {
      transport.close();
      await server.close();
    }
  }
});

it('cancels TCP reads, bounds queues, closes deterministically and rejects pre-cancelled sends', async () => {
  assert.equal(typeof protocol.TcpTransport, 'function');
  let accepted = 0;
  const server = await serverFor(() => {
    accepted++;
  });
  const transport = new protocol.TcpTransport({
    host: '127.0.0.1',
    port: server.port,
    timeout: 30,
  });
  try {
    const abort = new globalThis.AbortController();
    abort.abort(new Error('before connect'));
    await assert.rejects(
      transport.request(Buffer.alloc(4), { signal: abort.signal }),
      /before connect/
    );
    assert.equal(accepted, 0);
    await transport.send(Buffer.alloc(4));
    await assert.rejects(transport.receive(), /timeout/i);
    const pending = transport.receive({ timeout: 5000 });
    transport.close();
    await assert.rejects(pending, /closed/i);
    await assert.rejects(transport.send(Buffer.alloc(4)), /closed/i);
  } finally {
    transport.close();
    await server.close();
  }
});

it('uses send-only acknowledgements and receives additional RPC packets without http_wait', async () => {
  const calls = [];
  const packets = [];
  let serverId = (BigInt(Math.floor(Date.now() / 1000)) << 32n) + 1n;
  const transport = {
    send: async (packet) => {
      const request = client.cipher.decrypt(packet, { server: false });
      const value = client.codec.decode(request.body);
      calls.push(value._);
      if (value._ === 'msgs_ack') {
        return;
      }
      const result = Buffer.alloc(12);
      result.writeUInt32LE(0xf35c6d01);
      result.writeBigInt64LE(request.messageId, 4);
      for (const body of [
        client.codec.encode({ _: 'msgs_ack', msg_ids: [request.messageId] }),
        Buffer.concat([result, client.codec.encode(true, 'Bool')]),
      ]) {
        serverId += 4n;
        packets.push(
          client.cipher.encrypt(body, {
            server: true,
            messageId: serverId,
            sequence: 1,
          })
        );
      }
    },
    receive: async () => {
      assert(
        packets.length,
        'Client waited for a reply to a send-only acknowledgement'
      );
      return packets.shift();
    },
    request: async (packet, options) => {
      await transport.send(packet, options);
      return transport.receive(options);
    },
  };
  const client = new protocol.Mtproto({
    authKey: Buffer.alloc(256, 42),
    transport,
    timeout: 1000,
  });
  assert.equal(
    await client.call('account.updateStatus', { offline: true }),
    true
  );
  assert.deepEqual(calls, ['account.updateStatus', 'msgs_ack']);
  assert.equal(packets.length, 0);
});

it('keeps a shared pending connection after another caller cancels and closes it on shutdown', async () => {
  const { Duplex } = await import('node:stream');
  let opened = 0;
  const transport = new protocol.TcpTransport({
    timeout: 1000,
    connectSocket: () => {
      opened++;
      return new Duplex({
        read() {},
        write(bytes, encoding, done) {
          done();
        },
      });
    },
  });
  try {
    const first = assert.rejects(transport.connect(), /closed/i);
    const controller = new globalThis.AbortController();
    const second = assert.rejects(
      transport.connect({ signal: controller.signal }),
      /cancelled/i
    );
    controller.abort(new Error('caller cancelled'));
    await second;
    const third = assert.rejects(transport.connect(), /closed/i);
    assert.equal(opened, 1);
    transport.close();
    await Promise.all([first, third]);
  } finally {
    transport.close();
  }
});

it('bounds unsolicited queued packet bytes and rejects overlapping pending reads', async () => {
  const { Duplex } = await import('node:stream');
  const transport = new protocol.TcpTransport({
    maxQueuedBytes: 4,
    timeout: 1000,
  });
  const socket = new Duplex({
    read() {},
    write(bytes, encoding, done) {
      done();
    },
  });
  transport.socket = socket;
  try {
    const writer = new protocol.TransportFraming();
    transport.accept(writer.encode(Buffer.alloc(4, 1)), socket);
    transport.accept(writer.encode(Buffer.alloc(4, 2)), socket);
    await assert.rejects(transport.receive(), /limit/i);
    assert.equal(transport.queuedBytes, 0);
  } finally {
    transport.close();
  }
  const other = new protocol.TcpTransport({ timeout: 1000 });
  other.socket = new Duplex({
    read() {},
    write(bytes, encoding, done) {
      done();
    },
  });
  try {
    const first = assert.rejects(other.receive(), /closed/i);
    await assert.rejects(other.receive(), /already pending/i);
    other.close();
    await first;
  } finally {
    other.close();
  }
});

it('treats an idle persistent update poll as an empty tick and preserves user cancellation', async () => {
  const { TelegramError } = await import('../src/errors.js');
  const transport = {
    request: async () => assert.fail('Persistent polling sent a request'),
    receive: async () => {
      throw new TelegramError('idle', { type: 'TRANSPORT_TIMEOUT' });
    },
  };
  const client = new protocol.Mtproto({
    authKey: Buffer.alloc(256, 42),
    transport,
  });
  await client.pollUpdates({ maxWait: 1 });
  const controller = new globalThis.AbortController();
  const reason = new Error('user cancelled');
  controller.abort(reason);
  transport.receive = async ({ signal }) => {
    signal.throwIfAborted();
  };
  await assert.rejects(
    client.pollUpdates({ signal: controller.signal }),
    (e) => e === reason
  );
});

it('runs encrypted multi-packet RPCs over a real native TCP connection', async () => {
  const calls = [];
  let serverId = (BigInt(Math.floor(Date.now() / 1000)) << 32n) + 1n;
  const server = await framedServerFor('full', (packet, reply) => {
    const request = client.cipher.decrypt(packet, { server: false });
    const value = client.codec.decode(request.body);
    calls.push(value._);
    if (value._ === 'msgs_ack') {
      return;
    }
    assert.equal(value._, 'account.updateStatus');
    const result = Buffer.alloc(12);
    result.writeUInt32LE(0xf35c6d01);
    result.writeBigInt64LE(request.messageId, 4);
    for (const body of [
      client.codec.encode({ _: 'msgs_ack', msg_ids: [] }),
      Buffer.concat([result, client.codec.encode(true, 'Bool')]),
    ]) {
      serverId += 4n;
      reply(
        client.cipher.encrypt(body, {
          server: true,
          messageId: serverId,
          sequence: 1,
        })
      );
    }
  });
  const client = new protocol.Mtproto({
    transport: 'tcp',
    mode: 'full',
    host: '127.0.0.1',
    port: server.port,
    authKey: Buffer.alloc(256, 42),
    timeout: 1000,
  });
  try {
    assert.equal(
      await client.call('account.updateStatus', { offline: true }),
      true
    );
    assert.equal(
      await client.call('account.updateStatus', { offline: false }),
      true
    );
    assert.equal(
      calls.filter((method) => method === 'account.updateStatus').length,
      2
    );
    assert(!calls.includes('http_wait'));
  } finally {
    await client.disconnect();
    await server.close();
  }
});
