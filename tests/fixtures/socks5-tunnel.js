import assert from 'node:assert/strict';
import { createConnection } from 'node:net';
import { serverFor } from './tcp-server.js';

/** Maps every requested endpoint to one loopback server; never contacts the Internet. */
export async function socks5Tunnel(port) {
  const upstreams = new Set();
  const hosts = [];
  const server = await serverFor((socket) => {
    let pending = Buffer.alloc(0);
    let greeting = true;
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
      if (pending.length < 5) {
        return;
      }
      const domain = pending[3] === 3;
      const length = domain ? 7 + pending[4] : 10;
      if (pending.length < length) {
        return;
      }
      hosts.push(
        domain
          ? pending.subarray(5, length - 2).toString()
          : [...pending.subarray(4, 8)].join('.')
      );
      socket.removeListener('data', negotiate);
      const upstream = createConnection({ host: '127.0.0.1', port });
      upstreams.add(upstream);
      upstream.on('error', () => socket.destroy());
      upstream.on('close', () => upstreams.delete(upstream));
      socket.on('close', () => upstream.destroy());
      upstream.once('connect', () => {
        socket.write(Buffer.from([5, 0, 0, 1, 127, 0, 0, 1, 0, 0]));
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
