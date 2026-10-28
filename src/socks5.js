import { createConnection, isIP } from 'node:net';
import { Duplex } from 'node:stream';
import { domainToASCII } from 'node:url';
import { TelegramError } from './errors.js';

const failure = (message, code) =>
  new TelegramError(`SOCKS5 ${message}`, { type: 'PROXY_ERROR', code });

/** Independent CONNECT connector. Destinations are resolved by the proxy. */
export function createSocks5Connector(options = {}) {
  const host = options.host ?? options.ip;
  const port = options.port ?? 1080;
  if (
    typeof host !== 'string' ||
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535 ||
    options.secret !== undefined ||
    ![undefined, 5].includes(options.socksType) ||
    ![undefined, 'socks5'].includes(options.type)
  ) {
    throw new TypeError('Invalid SOCKS5 proxy endpoint or type');
  }
  const auth = authentication(options.username, options.password);
  return (destination) =>
    new SocksSocket({ host, port }, auth, destinationPacket(destination));
}

function authentication(username, password) {
  if (username === undefined && password === undefined) {
    return undefined;
  }
  if (typeof username !== 'string' || typeof password !== 'string') {
    throw new TypeError('SOCKS5 username and password are required together');
  }
  const user = Buffer.from(username);
  const pass = Buffer.from(password);
  if (
    user.length < 1 ||
    user.length > 255 ||
    pass.length < 1 ||
    pass.length > 255
  ) {
    throw new RangeError('SOCKS5 credentials must contain 1–255 UTF-8 bytes');
  }
  return Buffer.concat([
    Buffer.from([1, user.length]),
    user,
    Buffer.from([pass.length]),
    pass,
  ]);
}

function destinationPacket({ host, port }) {
  if (
    typeof host !== 'string' ||
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new RangeError('Invalid SOCKS5 destination');
  }
  const kind = isIP(host);
  let address;
  if (kind === 4) {
    address = Buffer.from([1, ...host.split('.').map(Number)]);
  } else if (kind === 6) {
    address = Buffer.concat([Buffer.from([4]), ipv6(host)]);
  } else {
    const ascii = domainToASCII(host);
    if (!ascii || ascii.length > 255 || /[\s\0/\\:@%[\]]/.test(ascii)) {
      throw new TypeError('Invalid SOCKS5 destination domain');
    }
    const bytes = Buffer.from(ascii);
    address = Buffer.concat([Buffer.from([3, bytes.length]), bytes]);
  }
  const encodedPort = Buffer.alloc(2);
  encodedPort.writeUInt16BE(port);
  return Buffer.concat([Buffer.from([5, 1, 0]), address, encodedPort]);
}

function ipv6(host) {
  if (host.includes('%')) {
    throw new TypeError('SOCKS5 scoped IPv6 destinations are unsupported');
  }
  if (host.includes('.')) {
    const split = host.lastIndexOf(':');
    const bytes = host
      .slice(split + 1)
      .split('.')
      .map(Number);
    host = `${
      host.slice(0, split + 1) + ((bytes[0] << 8) | bytes[1]).toString(16)
    }:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
  }
  const [left, right] = host.split('::');
  const front = left ? left.split(':') : [];
  const back = right ? right.split(':') : [];
  const parts =
    right === undefined
      ? front
      : [...front, ...Array(8 - front.length - back.length).fill('0'), ...back];
  const encoded = Buffer.alloc(16);
  parts.forEach((value, index) =>
    encoded.writeUInt16BE(parseInt(value, 16), index * 2)
  );
  return encoded;
}

class SocksSocket extends Duplex {
  #auth;
  constructor(proxy, auth, request) {
    super();
    this.#auth = auth;
    this.request = request;
    this.state = 'method';
    this.buffer = Buffer.alloc(0);
    this.socket = createConnection(proxy);
    this.socket.once('connect', () =>
      this.socket.write(Buffer.from([5, 1, auth ? 2 : 0]))
    );
    this.socket.on('data', (bytes) => this.accept(bytes));
    this.socket.on('error', (error) => this.destroy(error));
    this.socket.on('end', () => {
      if (this.state === 'ready') {
        this.push(null);
      } else {
        this.destroy(failure('proxy closed during negotiation'));
      }
    });
    this.socket.on('close', () => {
      if (!this.destroyed) {
        this.destroy();
      }
    });
  }
  _read() {
    this.socket.resume();
  }
  _write(bytes, encoding, done) {
    if (this.state !== 'ready') {
      done(failure('tunnel is not connected'));
      return;
    }
    this.socket.write(bytes, encoding, done);
  }
  _final(done) {
    this.socket.end(done);
  }
  _destroy(error, done) {
    this.socket.destroy();
    done(error);
  }
  setNoDelay(value) {
    this.socket.setNoDelay(value);
    return this;
  }
  accept(bytes) {
    if (this.state === 'ready') {
      if (!this.push(bytes)) {
        this.socket.pause();
      }
      return;
    }
    try {
      // Negotiation needs at most 262 bytes. Coalesced tunnel bytes are not
      // negotiation input and may be larger after the CONNECT response.
      this.buffer = Buffer.concat([this.buffer, bytes]);
      for (let step = 0; step < 3; step++) {
        if (this.state === 'reply') {
          if (!this.acceptReply()) {
            return;
          }
        } else {
          if (this.buffer.length < 2) {
            return;
          }
          const version = this.buffer[0];
          const status = this.buffer[1];
          this.buffer = this.buffer.subarray(2);
          if (this.state === 'method') {
            this.acceptMethod(version, status);
          } else {
            this.acceptAuthentication(version, status);
          }
        }
        if (this.state === 'ready') {
          return;
        }
      }
    } catch (error) {
      this.destroy(error);
    }
  }
  acceptMethod(version, method) {
    if (version !== 5 || method !== (this.#auth ? 2 : 0)) {
      throw failure('authentication method rejected', method);
    }
    if (this.#auth) {
      this.state = 'auth';
      this.socket.write(this.#auth);
    } else {
      this.requestTunnel();
    }
  }
  acceptAuthentication(version, status) {
    if (version !== 1 || status !== 0) {
      throw failure('authentication failed', status);
    }
    this.#auth = undefined;
    this.requestTunnel();
  }
  requestTunnel() {
    this.state = 'reply';
    this.socket.write(this.request);
  }
  acceptReply() {
    const bytes = this.buffer;
    if (bytes.length < 4) {
      return false;
    }
    if (bytes[0] !== 5 || bytes[2] !== 0) {
      throw failure('invalid CONNECT response');
    }
    if (bytes[1] !== 0) {
      throw failure('CONNECT rejected', bytes[1]);
    }
    const length = replyLength(bytes);
    if (length === undefined || bytes.length < length) {
      return false;
    }
    this.state = 'ready';
    this.buffer = Buffer.alloc(0);
    this.emit('connect');
    if (bytes.length > length && !this.push(bytes.subarray(length))) {
      this.socket.pause();
    }
    return true;
  }
}

function replyLength(bytes) {
  if (bytes[3] === 1) {
    return 10;
  }
  if (bytes[3] === 4) {
    return 22;
  }
  if (bytes[3] !== 3) {
    throw failure('invalid CONNECT address type');
  }
  if (bytes.length < 5) {
    return undefined;
  }
  if (!bytes[4]) {
    throw failure('empty CONNECT address');
  }
  return 7 + bytes[4];
}
