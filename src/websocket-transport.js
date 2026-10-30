import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { connect as tlsConnect } from 'node:tls';
import { createConnection, isIP } from 'node:net';
import { Duplex } from 'node:stream';
import { randomBytes, createHash } from 'node:crypto';
import { TcpTransport } from './tcp-transport.js';
import { createSocksConnector } from './socks5.js';
import { WebSocketFraming, websocketError } from './websocket-framing.js';
import { dcUrl } from './endpoints.js';

export class WebSocketTransport extends TcpTransport {
  constructor({
    dc = 2,
    test = false,
    url = dcUrl(dc, test, true),
    proxy,
    ca,
    maxWebSocketBytes = 32 * 1024 * 1024,
    ...options
  } = {}) {
    const endpoint = websocketUrl(url);
    if (options.connectSocket || options.obfuscate === false) {
      throw new TypeError(
        'WebSocket requires its socket connector and obfuscation'
      );
    }
    const connector = proxy ? createSocksConnector(proxy) : createConnection;
    // Validate frame limits before opening sockets; each connection gets fresh state.
    new WebSocketFraming({
      maxBytes: maxWebSocketBytes,
      maxFrames: options.maxPackets,
    });
    super({
      ...options,
      dc,
      test,
      host: endpoint.hostname,
      port: Number(endpoint.port || (endpoint.protocol === 'wss:' ? 443 : 80)),
      obfuscate: true,
      connectSocket: () =>
        new WebSocketSocket(endpoint, {
          connector,
          ca,
          maxBytes: maxWebSocketBytes,
          maxFrames: options.maxPackets,
        }),
    });
  }
}

class WebSocketSocket extends Duplex {
  constructor(url, { connector, ca, ...options }) {
    super();
    this.frames = new WebSocketFraming(options);
    const key = randomBytes(16).toString('base64');
    this.acceptKey = createHash('sha1')
      .update(`${key}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');
    const secure = url.protocol === 'wss:';
    const host = url.hostname.replace(/^\[|\]$/g, '');
    const port = Number(url.port || (secure ? 443 : 80));
    const requester = secure ? httpsRequest : httpRequest;
    this.request = requester({
      protocol: secure ? 'https:' : 'http:',
      hostname: host,
      port,
      path: url.pathname + url.search,
      method: 'GET',
      maxHeaderSize: 8192,
      headers: {
        Upgrade: 'websocket',
        Connection: 'Upgrade',
        'Sec-WebSocket-Key': key,
        'Sec-WebSocket-Version': '13',
        'Sec-WebSocket-Protocol': 'binary',
      },
      createConnection: (options, callback) =>
        this.openSocket({ host, port, secure, ca, connector }, callback),
    });
    this.request.on('error', (error) => this.destroy(error));
    this.request.on('response', (response) => {
      response.destroy();
      this.destroy(websocketError('upgrade rejected', response.statusCode));
    });
    this.request.on('upgrade', (response, socket, head) =>
      this.upgrade(response, socket, head)
    );
    this.request.end();
  }
  openSocket({ host, port, secure, ca, connector }, callback) {
    const raw = connector({ host, port });
    this.rawSocket = raw;
    let completed = false;
    const done = (error, socket) => {
      if (!completed) {
        completed = true;
        callback(error, socket);
      }
    };
    raw.once('error', done);
    raw.once('close', () => {
      if (!this.tlsSocket) {
        done(websocketError('closed during connection'));
      }
    });
    raw.once('connect', () => {
      if (this.destroyed) {
        raw.destroy();
        return;
      }
      if (!secure) {
        done(null, raw);
        return;
      }
      const socket = tlsConnect({
        socket: raw,
        host,
        servername: isIP(host) ? undefined : host,
        ca: ca instanceof Uint8Array ? Buffer.from(ca) : ca,
      });
      this.tlsSocket = socket;
      socket.once('secureConnect', () => done(null, socket));
      socket.once('error', done);
      socket.once('close', () => done(websocketError('closed during TLS')));
    });
  }
  upgrade(response, socket, head) {
    if (this.destroyed) {
      socket.destroy();
      return;
    }
    this.socket = socket;
    try {
      validateUpgrade(response, this.acceptKey);
      socket.on('error', (error) => this.destroy(error));
      socket.on('data', (bytes) => this.accept(bytes));
      socket.on('end', () => this.push(null));
      socket.on('close', () =>
        this.destroy(websocketError('connection closed'))
      );
      this.ready = true;
      this.emit('connect');
      this.accept(head);
    } catch (error) {
      this.destroy(error);
    }
  }
  accept(bytes) {
    try {
      for (const frame of this.frames.push(bytes)) {
        if (this.closing || this.destroyed) {
          break;
        }
        if (frame.opcode === 8) {
          this.finishClose(frame.payload);
        } else if (frame.opcode === 9) {
          this.socket.write(this.frames.encode(frame.payload, { opcode: 10 }));
        } else if (frame.opcode !== 10 && !this.push(frame.payload)) {
          this.socket.pause();
        }
      }
    } catch (error) {
      this.destroy(error);
    }
  }
  finishClose(bytes) {
    const error = closeError(bytes);
    this.closing = true;
    this.socket.end(this.frames.encode(bytes, { opcode: 8 }), () =>
      this.destroy(error)
    );
  }
  _read() {
    this.socket?.resume();
  }
  _write(bytes, encoding, done) {
    if (!this.ready || this.closing) {
      done(websocketError('is not connected'));
      return;
    }
    try {
      this.socket.write(this.frames.encode(bytes), done);
    } catch (error) {
      done(error);
    }
  }
  _final(done) {
    if (this.socket) {
      this.socket.end(done);
    } else {
      done();
    }
  }
  _destroy(error, done) {
    this.request?.destroy();
    this.socket?.destroy();
    this.tlsSocket?.destroy();
    this.rawSocket?.destroy();
    done(error);
  }
  setNoDelay(value) {
    this.rawSocket?.setNoDelay?.(value);
    return this;
  }
}

function websocketUrl(value) {
  const url = new globalThis.URL(value);
  if (
    !['ws:', 'wss:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.hash
  ) {
    throw new TypeError('Invalid WebSocket URL');
  }
  return url;
}

function validateUpgrade({ statusCode, headers }, accept) {
  if (
    statusCode !== 101 ||
    headers.upgrade?.toLowerCase() !== 'websocket' ||
    !headers.connection
      ?.toLowerCase()
      .split(/\s*,\s*/)
      .includes('upgrade') ||
    headers['sec-websocket-accept'] !== accept ||
    headers['sec-websocket-protocol'] !== 'binary' ||
    headers['sec-websocket-extensions']
  ) {
    throw websocketError('invalid upgrade response');
  }
}

function closeError(bytes) {
  if (bytes.length === 1) {
    throw websocketError('invalid close payload');
  }
  if (!bytes.length) {
    return websocketError('connection closed');
  }
  const code = bytes.readUInt16BE();
  if (
    code < 1000 ||
    code >= 5000 ||
    [1004, 1005, 1006, 1015].includes(code) ||
    (code > 1015 && code < 3000)
  ) {
    throw websocketError('invalid close status');
  }
  const reason = closeReason(bytes.subarray(2));
  const actual = /^-?\d+$/.test(reason) ? Number(reason) : undefined;
  return websocketError(
    'connection closed',
    Number.isSafeInteger(actual) ? Math.abs(actual) : code
  );
}

function closeReason(bytes) {
  try {
    return new globalThis.TextDecoder('utf-8', { fatal: true })
      .decode(bytes)
      .trim();
  } catch {
    throw websocketError('invalid close reason encoding');
  }
}
