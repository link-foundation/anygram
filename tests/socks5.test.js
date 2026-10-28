import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as protocol from '../src/mtproto.js';
import { serverFor } from './fixtures/tcp-server.js';

async function proxyFor({
  method,
  authStatus = 0,
  replyStatus = 0,
  replyType = 1,
  rawReply,
  welcome = Buffer.alloc(0),
  silent = false,
} = {}) {
  const trace = [];
  const server = await serverFor((socket) => {
    let state = 'greeting';
    let buffered = Buffer.alloc(0);
    let header = 4;
    socket.on('data', (data) => {
      buffered = Buffer.concat([buffered, data]);
      assert(buffered.length <= 4096, 'Fixture byte bound exceeded');
      for (let step = 0; step < 4; step++) {
        if (state === 'greeting') {
          if (buffered.length < 2 || buffered.length < 2 + buffered[1]) {
            return;
          }
          const count = buffered[1];
          assert.equal(buffered[0], 5);
          const selected = method ?? buffered[2];
          trace.push(['methods', ...buffered.subarray(2, 2 + count)]);
          buffered = buffered.subarray(2 + count);
          state = selected === 2 ? 'auth' : 'request';
          if (!silent) {
            socket.write(Buffer.from([5]));
            socket.write(Buffer.from([selected]));
          }
        } else if (state === 'auth') {
          const auth = readAuthentication(buffered);
          if (!auth) {
            return;
          }
          trace.push(['auth', auth.username, auth.password]);
          buffered = buffered.subarray(auth.length);
          state = 'request';
          socket.write(Buffer.from([1, authStatus]));
        } else if (state === 'request') {
          const request = readRequest(buffered);
          if (!request) {
            return;
          }
          trace.push(['request', request.toString('hex')]);
          buffered = buffered.subarray(request.length);
          state = 'stream';
          const response = rawReply ?? connectReply(replyType, replyStatus);
          socket.write(response.subarray(0, 3));
          socket.write(Buffer.concat([response.subarray(3), welcome]));
        } else {
          if (buffered.length < header) {
            return;
          }
          buffered = buffered.subarray(header);
          header = 0;
          if (buffered.length) {
            socket.write(buffered);
          }
          buffered = Buffer.alloc(0);
          return;
        }
      }
    });
  });
  return { ...server, trace };
}

function readAuthentication(buffered) {
  if (buffered.length < 2) {
    return undefined;
  }
  const userEnd = 2 + buffered[1];
  if (buffered.length < userEnd + 1) {
    return undefined;
  }
  const length = userEnd + 1 + buffered[userEnd];
  if (buffered.length < length) {
    return undefined;
  }
  assert.equal(buffered[0], 1);
  return {
    length,
    username: buffered.subarray(2, userEnd).toString(),
    password: buffered.subarray(userEnd + 1, length).toString(),
  };
}

function readRequest(buffered) {
  if (buffered.length < 5) {
    return undefined;
  }
  const length =
    buffered[3] === 1 ? 10 : buffered[3] === 4 ? 22 : 7 + buffered[4];
  return buffered.length < length ? undefined : buffered.subarray(0, length);
}

function connectReply(type, status) {
  const address =
    type === 1
      ? Buffer.alloc(4)
      : type === 4
        ? Buffer.alloc(16)
        : Buffer.from([3, 97, 98, 99]);
  return Buffer.concat([
    Buffer.from([5, status, 0, type]),
    address,
    Buffer.alloc(2),
  ]);
}

it('negotiates fragmented SOCKS5 tunnels with domain, IPv4 and IPv6 destinations', async () => {
  for (const [host, expected, replyType] of [
    [
      'telegram.invalid',
      `0310${Buffer.from('telegram.invalid').toString('hex')}`,
      1,
    ],
    ['149.154.167.51', '01959aa733', 3],
    ['2001:db8::1', '0420010db8000000000000000000000001', 4],
    ['::ffff:127.0.0.1', '0400000000000000000000ffff7f000001', 1],
  ]) {
    const proxy = await proxyFor({ replyType });
    const transport = new protocol.TcpTransport({
      host,
      port: 443,
      proxy: { host: '127.0.0.1', port: proxy.port },
      timeout: 1000,
    });
    try {
      const packet = Buffer.alloc(32, 42);
      assert.deepEqual(await transport.request(packet), packet);
      assert.deepEqual(proxy.trace[0], ['methods', 0]);
      assert.equal(proxy.trace[1][1], `050100${expected}01bb`);
    } finally {
      transport.close();
      await proxy.close();
    }
  }
});

it('rejects malformed CONNECT replies and preserves coalesced tunnel bytes', async () => {
  for (const rawReply of [
    Buffer.from([4, 0, 0, 1]),
    Buffer.from([5, 0, 1, 1]),
    Buffer.from([5, 0, 0, 2]),
    Buffer.from([5, 0, 0, 3, 0]),
  ]) {
    const proxy = await proxyFor({ rawReply });
    const transport = new protocol.TcpTransport({
      host: 'telegram.invalid',
      proxy: { host: '127.0.0.1', port: proxy.port },
      timeout: 1000,
    });
    try {
      await assert.rejects(
        transport.request(Buffer.alloc(4)),
        (error) => error.type === 'PROXY_ERROR'
      );
    } finally {
      transport.close();
      await proxy.close();
    }
  }
  const packet = Buffer.alloc(32, 123);
  const welcome = new protocol.TransportFraming().encode(packet);
  const proxy = await proxyFor({ welcome });
  const transport = new protocol.TcpTransport({
    host: 'telegram.invalid',
    proxy: { host: '127.0.0.1', port: proxy.port },
  });
  try {
    assert.deepEqual(await transport.receive(), packet);
    await assert.rejects(
      transport.connect({ signal: globalThis.AbortSignal.abort() }),
      /abort/i
    );
  } finally {
    transport.close();
    await proxy.close();
  }
});

it('uses RFC1929 UTF-8 credentials without downgrading or exposing secrets on failures', async () => {
  const password = 'private-password';
  for (const options of [
    {},
    { method: 0 },
    { authStatus: 1 },
    { replyStatus: 5 },
  ]) {
    const proxy = await proxyFor(options);
    const transport = new protocol.TcpTransport({
      host: 'telegram.invalid',
      proxy: {
        ip: '127.0.0.1',
        port: proxy.port,
        username: 'føø',
        password,
        socksType: 5,
      },
      timeout: 1000,
    });
    try {
      const result = transport.request(Buffer.alloc(32, 42));
      if (Object.keys(options).length === 0) {
        assert.deepEqual(await result, Buffer.alloc(32, 42));
        assert.deepEqual(proxy.trace.slice(0, 2), [
          ['methods', 2],
          ['auth', 'føø', password],
        ]);
      } else {
        await assert.rejects(
          result,
          (error) =>
            /SOCKS/.test(error.message) && !error.message.includes(password)
        );
      }
    } finally {
      transport.close();
      await proxy.close();
    }
  }
});

it('bounds SOCKS negotiation by the request deadline and validates settings before connecting', async () => {
  const proxy = await proxyFor({ silent: true });
  const transport = new protocol.TcpTransport({
    host: 'telegram.invalid',
    proxy: { host: '127.0.0.1', port: proxy.port },
    timeout: 30,
  });
  try {
    await assert.rejects(transport.request(Buffer.alloc(4)), /timeout/i);
  } finally {
    transport.close();
    await proxy.close();
  }
  for (const proxy of [
    { host: '127.0.0.1', port: 0 },
    { host: '127.0.0.1', port: 1080, socksType: 4 },
    { host: '127.0.0.1', port: 1080, username: 'u', password: 'p'.repeat(256) },
  ]) {
    assert.throws(() => new protocol.TcpTransport({ proxy }), /SOCKS|proxy/i);
  }
  assert.throws(
    () =>
      new protocol.Mtproto({
        transport: 'http',
        proxy: { host: '127.0.0.1', port: 1080 },
      }),
    /proxy/i
  );
  const client = new protocol.Mtproto({
    proxy: { host: '127.0.0.1', port: 1080 },
  });
  assert(client.transport instanceof protocol.TcpTransport);
  await client.disconnect();
});
