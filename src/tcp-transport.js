import { createConnection } from 'node:net';
import { TransportFraming } from './transport-framing.js';
import { dcAddress, validateSocketEndpoint } from './endpoints.js';
import { validateTimeout, createRequestScope } from './http.js';
import { TelegramError } from './errors.js';
import { createSocksConnector } from './socks5.js';
import { ObfuscatedFraming } from './obfuscated-framing.js';
import { abortable } from './cancellation.js';

/** Persistent packet stream. It never retries a possibly transmitted packet. */
export class TcpTransport {
  #framingOptions;
  constructor({
    dc = 2,
    test = false,
    host,
    port = 443,
    mode,
    timeout = 30000,
    maxBytes = 16 * 1024 * 1024,
    maxPackets = 1000,
    maxQueuedBytes = 32 * 1024 * 1024,
    onQuickAck,
    connectSocket,
    proxy,
    obfuscate,
    media,
  } = {}) {
    const route = proxyRoute({ host, port, mode, proxy, obfuscate });
    route.host ??= dcAddress(dc, test);
    validateTimeout(timeout);
    validateEndpoint(route.host, route.port, maxQueuedBytes);
    connectSocket = socketConnector(connectSocket, proxy);
    Object.assign(this, {
      host: route.host,
      port: route.port,
      timeout,
      maxPackets,
      maxQueuedBytes,
      connectSocket,
    });
    this.#framingOptions = {
      ...route,
      maxBytes,
      maxPackets,
      onQuickAck,
      dc,
      test,
      media,
    };
    this.framing = createFraming(this.#framingOptions);
    this.packets = [];
    this.queuedBytes = 0;
    this.closed = false;
  }
  async connect(options = {}) {
    const scope = requestScope(options, this.timeout);
    let ownsConnection = false;
    try {
      this.assertOpen(scope.signal);
      if (this.connecting) {
        return await abortable(this.connecting, scope.signal);
      }
      if (this.socket && !this.failure) {
        return;
      }
      this.failure = undefined;
      this.framing = createFraming(this.#framingOptions);
      const socket = this.connectSocket({ host: this.host, port: this.port });
      this.socket = socket;
      ownsConnection = true;
      this.connecting = new Promise((resolve, reject) => {
        const abort = () => this.fail(scope.signal.reason, socket);
        const clean = () => {
          scope.signal.removeEventListener('abort', abort);
          socket.removeListener('connect', ready);
          socket.removeListener('error', reject);
          socket.removeListener('close', disconnected);
        };
        const ready = () => {
          this.socket = socket;
          socket.setNoDelay?.(true);
          socket.write(this.framing.header, (error) => {
            clean();
            if (error) {
              reject(error);
            } else {
              resolve();
            }
          });
        };
        const disconnected = () => {
          clean();
          reject(this.failure ?? new Error('TCP connection closed'));
        };
        socket.on('data', (bytes) => this.accept(bytes, socket));
        socket.on('error', (error) => this.fail(error, socket));
        socket.on('close', () =>
          this.fail(new Error('TCP connection closed'), socket)
        );
        socket.once('connect', ready);
        socket.once('error', reject);
        socket.once('close', disconnected);
        scope.signal.addEventListener('abort', abort, { once: true });
        if (scope.signal.aborted) {
          abort();
        }
      });
      await this.connecting;
    } finally {
      if (ownsConnection) {
        this.connecting = undefined;
      }
      scope.dispose();
    }
  }
  accept(bytes, socket) {
    if (socket !== this.socket || this.failure) {
      return;
    }
    try {
      for (const packet of this.framing.push(bytes)) {
        if (this.waiter) {
          this.waiter.resolve(packet);
        } else {
          if (
            this.packets.length >= this.maxPackets ||
            this.queuedBytes + packet.length > this.maxQueuedBytes
          ) {
            throw new RangeError('TCP pending packet limit exceeded');
          }
          this.packets.push(packet);
          this.queuedBytes += packet.length;
        }
      }
    } catch (error) {
      this.fail(error, socket);
    }
  }
  fail(error, socket = this.socket) {
    if (socket && socket !== this.socket) {
      return;
    }
    this.failure ??= error;
    this.waiter?.reject(this.failure);
    this.packets.length = 0;
    this.queuedBytes = 0;
    socket?.destroy();
  }
  async send(packet, options = {}) {
    const scope = requestScope(options, this.timeout);
    try {
      scope.signal.throwIfAborted();
      this.framing.validatePayload(packet);
      await this.connectScoped(scope, options);
      const bytes = this.framing.encode(packet);
      await new Promise((resolve, reject) => {
        const abort = () => {
          this.fail(scope.signal.reason);
          reject(scope.signal.reason);
        };
        scope.signal.addEventListener('abort', abort, { once: true });
        this.socket.write(bytes, (error) => {
          scope.signal.removeEventListener('abort', abort);
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    } finally {
      scope.dispose();
    }
  }
  async receive(options = {}) {
    const scope = requestScope(options, this.timeout);
    try {
      this.assertReadable(scope.signal);
      if (this.packets.length) {
        return this.shiftPacket();
      }
      await this.connectScoped(scope, options);
      this.assertReadable(scope.signal);
      // A packet can arrive during connection setup.
      return this.packets.length
        ? this.shiftPacket()
        : await this.waitForPacket(scope.signal);
    } finally {
      scope.dispose();
    }
  }
  assertOpen(signal) {
    signal.throwIfAborted();
    if (this.closed) {
      throw new Error('TCP transport is closed');
    }
  }
  assertReadable(signal) {
    this.assertOpen(signal);
    if (this.failure) {
      throw this.failure;
    }
    if (this.waiter) {
      throw new Error('TCP receive is already pending');
    }
  }
  async connectScoped(scope, options) {
    await this.connect({
      signal: scope.signal,
      timeout: options.timeout ?? this.timeout,
    });
    scope.signal.throwIfAborted();
  }
  shiftPacket() {
    const packet = this.packets.shift();
    this.queuedBytes -= packet.length;
    return packet;
  }
  waitForPacket(signal) {
    return new Promise((resolve, reject) => {
      const abort = () => settle(reject, signal.reason);
      const settle = (complete, value) => {
        signal.removeEventListener('abort', abort);
        this.waiter = undefined;
        complete(value);
      };
      this.waiter = {
        resolve: (value) => settle(resolve, value),
        reject: (error) => settle(reject, error),
      };
      signal.addEventListener('abort', abort, { once: true });
      if (signal.aborted) {
        abort();
      }
    });
  }
  async request(packet, options = {}) {
    const scope = requestScope(options, this.timeout);
    try {
      const pending = { ...options, signal: scope.signal };
      await this.send(packet, pending);
      return await this.receive(pending);
    } finally {
      scope.dispose();
    }
  }
  close() {
    this.closed = true;
    this.fail(new Error('TCP transport is closed'));
  }
}

function requestScope({ signal, timeout }, fallback) {
  return createRequestScope(
    { signal, timeout: timeout ?? fallback },
    new TelegramError('TCP request timeout', { type: 'TRANSPORT_TIMEOUT' })
  );
}

function validateEndpoint(host, port, maxQueuedBytes) {
  validateSocketEndpoint(host, port, 'TCP endpoint');
  if (!Number.isSafeInteger(maxQueuedBytes) || maxQueuedBytes < 4) {
    throw new RangeError('Invalid TCP queued byte limit');
  }
}

function socketConnector(connectSocket, proxy) {
  if (proxy && connectSocket) {
    throw new TypeError('Choose either a proxy or a custom socket connector');
  }
  if (connectSocket) {
    return connectSocket;
  }
  if (!proxy || proxy.MTProxy === true || proxy.type === 'mtproxy') {
    return createConnection;
  }
  return createSocksConnector(proxy);
}

function createFraming(options) {
  return options.obfuscate
    ? new ObfuscatedFraming(options)
    : new TransportFraming(options);
}

function proxyRoute({ host, port, mode, proxy, obfuscate }) {
  const mtproxy = proxy?.MTProxy === true || proxy?.type === 'mtproxy';
  let secret;
  if (mtproxy) {
    host = proxy.host ?? proxy.ip;
    port = proxy.port ?? 443;
    secret = proxy.secret;
    if (!secret) {
      throw new TypeError('MTProxy secret is required');
    }
    if (secret instanceof Uint8Array) {
      secret = Buffer.from(secret);
    }
  }
  return {
    host,
    port,
    mode: mode ?? (mtproxy ? 'padded' : 'intermediate'),
    obfuscate: obfuscate || mtproxy,
    secret,
  };
}
