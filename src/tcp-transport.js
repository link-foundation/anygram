import { createConnection } from 'node:net';
import { TransportFraming } from './transport-framing.js';
import { dcAddress } from './endpoints.js';
import { validateTimeout } from './http.js';
import { TelegramError } from './errors.js';
import { createSocks5Connector } from './socks5.js';

/** Persistent packet stream. It never retries a possibly transmitted packet. */
export class TcpTransport {
  constructor({
    dc = 2,
    test = false,
    host = dcAddress(dc, test),
    port = 443,
    mode = 'intermediate',
    timeout = 30000,
    maxBytes = 16 * 1024 * 1024,
    maxPackets = 1000,
    maxQueuedBytes = 32 * 1024 * 1024,
    onQuickAck,
    connectSocket,
    proxy,
  } = {}) {
    validateTimeout(timeout);
    validateEndpoint(host, port, maxQueuedBytes);
    connectSocket = socketConnector(connectSocket, proxy);
    Object.assign(this, {
      host,
      port,
      timeout,
      maxPackets,
      maxQueuedBytes,
      connectSocket,
    });
    this.framingOptions = { mode, maxBytes, maxPackets, onQuickAck };
    this.framing = new TransportFraming(this.framingOptions);
    this.packets = [];
    this.queuedBytes = 0;
    this.closed = false;
  }
  async connect(options = {}) {
    const scope = requestScope(options, this.timeout);
    let ownsConnection = false;
    try {
      scope.signal.throwIfAborted();
      if (this.closed) {
        throw new Error('TCP transport is closed');
      }
      if (this.connecting) {
        return await abortable(this.connecting, scope.signal);
      }
      if (this.socket && !this.failure) {
        return;
      }
      this.failure = undefined;
      this.framing = new TransportFraming(this.framingOptions);
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
      await this.connect({
        signal: scope.signal,
        timeout: options.timeout ?? this.timeout,
      });
      scope.signal.throwIfAborted();
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
      scope.signal.throwIfAborted();
      if (this.closed) {
        throw new Error('TCP transport is closed');
      }
      if (this.failure) {
        throw this.failure;
      }
      if (this.waiter) {
        throw new Error('TCP receive is already pending');
      }
      if (this.packets.length) {
        const packet = this.packets.shift();
        this.queuedBytes -= packet.length;
        return packet;
      }
      await this.connect({
        signal: scope.signal,
        timeout: options.timeout ?? this.timeout,
      });
      scope.signal.throwIfAborted();
      if (this.closed || this.failure) {
        throw this.failure ?? new Error('TCP transport is closed');
      }
      if (this.waiter) {
        throw new Error('TCP receive is already pending');
      }
      // A packet can arrive during connection setup.
      if (this.packets.length) {
        const packet = this.packets.shift();
        this.queuedBytes -= packet.length;
        return packet;
      }
      return await this.waitForPacket(scope.signal);
    } finally {
      scope.dispose();
    }
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
  timeout ??= fallback;
  validateTimeout(timeout);
  const controller = new globalThis.AbortController();
  const timer = globalThis.setTimeout(
    () =>
      controller.abort(
        new TelegramError('TCP request timeout', { type: 'TRANSPORT_TIMEOUT' })
      ),
    timeout
  );
  return {
    signal: signal
      ? globalThis.AbortSignal.any([signal, controller.signal])
      : controller.signal,
    dispose: () => globalThis.clearTimeout(timer),
  };
}

function validateEndpoint(host, port, maxQueuedBytes) {
  if (
    typeof host !== 'string' ||
    !host ||
    !Number.isInteger(port) ||
    port < 1 ||
    port > 65535
  ) {
    throw new RangeError('Invalid TCP endpoint');
  }
  if (!Number.isSafeInteger(maxQueuedBytes) || maxQueuedBytes < 4) {
    throw new RangeError('Invalid TCP queued byte limit');
  }
}

function socketConnector(connectSocket, proxy) {
  if (proxy && connectSocket) {
    throw new TypeError('Choose either a proxy or a custom socket connector');
  }
  return (
    connectSocket ?? (proxy ? createSocks5Connector(proxy) : createConnection)
  );
}

function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    promise
      .then(resolve, reject)
      .finally(() => signal.removeEventListener('abort', abort));
    if (signal.aborted) {
      abort();
    }
  });
}
