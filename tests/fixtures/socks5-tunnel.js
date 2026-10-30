import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { serverFor } from './tcp-server.js';

/** Maps every requested endpoint to one loopback server; never contacts the Internet. */
export const socks5Tunnel = (port) => socksTunnel(port, 5);

export async function socksTunnel(port, version = 5) {
  const upstreams = new Set();
  const hosts = [];
  const server = await serverFor((socket) => {
    let pending = Buffer.alloc(0);
    let greeting = version === 5;
    function negotiate(bytes) {
      pending = Buffer.concat([pending, bytes]);
      assert(pending.length <= 1024, 'SOCKS fixture negotiation limit');
      if (greeting) {
        if (pending.length < 3) {
          return;
        }
        assert.deepEqual(pending.subarray(0, 3), Buffer.from([5, 1, 0]));
        pending = pending.subarray(3);
        greeting = false;
        socket.write(Buffer.from([5, 0]));
      }
      const request =
        version === 4 ? socks4Request(pending) : socks5Request(pending);
      if (!request) {
        return;
      }
      const { host, length } = request;
      hosts.push(host);
      socket.removeListener('data', negotiate);
      const upstream = createConnection({ host: '127.0.0.1', port });
      upstreams.add(upstream);
      upstream.on('error', () => socket.destroy());
      upstream.on('close', () => upstreams.delete(upstream));
      socket.on('close', () => upstream.destroy());
      upstream.once('connect', () => {
        socket.write(
          Buffer.from(
            version === 4
              ? [0, 90, 0, 0, 127, 0, 0, 1]
              : [5, 0, 0, 1, 127, 0, 0, 1, 0, 0]
          )
        );
        upstream.write(pending.subarray(length));
        socket.pipe(upstream).pipe(socket);
      });
    }
    socket.on('data', negotiate);
  });
  return {
    ...server,
    hosts,
    close: async () => {
      for (const socket of upstreams) {
        socket.destroy();
      }
      await server.close();
    },
  };
}

function socks5Request(bytes) {
  if (bytes.length < 5) {
    return undefined;
  }
  const domain = bytes[3] === 3;
  const length = domain ? 7 + bytes[4] : 10;
  if (bytes.length < length) {
    return undefined;
  }
  return {
    length,
    host: domain
      ? bytes.subarray(5, length - 2).toString()
      : [...bytes.subarray(4, 8)].join('.'),
  };
}

function socks4Request(bytes) {
  if (bytes.length < 9) {
    return undefined;
  }
  assert.deepEqual([...bytes.subarray(0, 2)], [4, 1]);
  const userEnd = bytes.indexOf(0, 8);
  if (userEnd < 0) {
    return undefined;
  }
  const domain = bytes.subarray(4, 7).equals(Buffer.alloc(3)) && bytes[7] !== 0;
  const end = domain ? bytes.indexOf(0, userEnd + 1) : userEnd;
  if (end < 0) {
    return undefined;
  }
  return {
    length: end + 1,
    host: domain
      ? bytes.subarray(userEnd + 1, end).toString()
      : [...bytes.subarray(4, 8)].join('.'),
  };
}
