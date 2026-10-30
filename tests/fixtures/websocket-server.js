import { createServer as httpServer } from 'node:http';
import { createServer as httpsServer } from 'node:https';
import { readFileSync } from 'node:fs';
import websocket from 'websocket';
import { TransportFraming } from '../../src/mtproto.js';
import { peerFor } from './obfuscated-peer.js';

export const localhostCa = readFileSync(
  new globalThis.URL('./localhost-cert.pem', import.meta.url)
);

/** Independent RFC 6455 implementation, restricted to loopback and finite messages. */
export async function referenceWebSocketServer({ secure = false } = {}) {
  const server = secure
    ? httpsServer({
        cert: localhostCa,
        key: readFileSync(
          new globalThis.URL('./localhost-key.pem', import.meta.url)
        ),
      })
    : httpServer();
  const sockets = new Set();
  const errors = [];
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
    socket.on('error', () => {});
  });
  server.on('tlsClientError', () => {});
  const ws = new websocket.server({
    httpServer: server,
    autoAcceptConnections: false,
    keepalive: false,
    fragmentOutgoingMessages: true,
    fragmentationThreshold: 7000,
    maxReceivedFrameSize: 128 * 1024,
    maxReceivedMessageSize: 128 * 1024,
    closeTimeout: 100,
  });
  ws.on('request', (request) => {
    const connection = request.accept('binary', request.origin);
    const framing = new TransportFraming();
    let buffer = Buffer.alloc(0);
    let peer;
    connection.on('error', (error) => errors.push(error));
    connection.on('message', (message) => {
      try {
        if (message.type !== 'binary') {
          throw new Error('Expected binary message');
        }
        buffer = Buffer.concat([buffer, message.binaryData]);
        if (!peer) {
          if (buffer.length < 64) {
            return;
          }
          peer = peerFor(buffer.subarray(0, 64));
          buffer = buffer.subarray(64);
        }
        for (const body of framing.push(peer.incoming.update(buffer))) {
          connection.sendBytes(peer.outgoing.update(framing.encode(body)));
        }
        buffer = Buffer.alloc(0);
      } catch (error) {
        errors.push(error);
        connection.drop();
      }
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  return {
    port,
    errors,
    url: `${secure ? 'wss' : 'ws'}://127.0.0.1:${port}/apiws`,
    close: async () => {
      for (const connection of [...ws.connections]) {
        connection.drop(undefined, undefined, true);
      }
      ws.shutDown();
      for (const socket of sockets) {
        socket.destroy();
      }
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
