import { createServer } from 'node:net';
import * as protocol from '../../src/mtproto.js';

export async function serverFor(handler) {
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

export async function framedServerFor(mode, handle) {
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
