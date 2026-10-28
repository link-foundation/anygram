import { gunzipSync } from 'node:zlib';
import { TlCodec, TlReader } from './tl.js';
import { createAuthKey } from './auth-key.js';
import { MtprotoCipher } from './crypto.js';
import { TelegramError } from './errors.js';
import { Session } from './session.js';
import { Authentication } from './authentication.js';
import { DatacenterPool } from './datacenters.js';
import { UpdateManager } from './updates.js';
import { objectRequest, requestOf } from './requests.js';

const hosts = ['pluto', 'venus', 'aurora', 'vesta', 'flora'];

export class HttpTransport {
  constructor({
    dc = 2,
    test = false,
    url,
    fetch: fetcher = globalThis.fetch,
    timeout = 30000,
    maxBytes = 16 * 1024 * 1024,
  } = {}) {
    if (!hosts[dc - 1]) {
      throw new RangeError('Unknown Telegram data center');
    }
    this.url =
      url ??
      `https://${hosts[dc - 1]}.web.telegram.org/${test ? 'apiw_test1' : 'apiw1'}`;
    this.fetch = fetcher;
    this.timeout = timeout;
    this.maxBytes = maxBytes;
    this.controllers = new Set();
  }

  async request(packet, { signal } = {}) {
    const controller = new globalThis.AbortController();
    this.controllers.add(controller);
    const timer = globalThis.setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetch(this.url, {
        method: 'POST',
        headers: { 'content-type': 'application/octet-stream' },
        body: packet,
        signal: signal
          ? globalThis.AbortSignal.any([signal, controller.signal])
          : controller.signal,
      });
      if (!response.ok) {
        throw new TelegramError('MTProto HTTP request failed', {
          code: response.status,
        });
      }
      const reader = response.body.getReader();
      const chunks = [];
      let length = 0;
      for (;;) {
        const { value, done } = await reader.read();
        if (done) {
          break;
        }
        length += value.length;
        if (length > this.maxBytes) {
          await reader.cancel();
          throw new RangeError('MTProto transport response exceeds byte limit');
        }
        chunks.push(value);
      }
      const bytes = Buffer.concat(chunks);
      if (bytes.length === 4) {
        throw new TelegramError('MTProto transport rejected packet', {
          code: bytes.readInt32LE(),
        });
      }
      return bytes;
    } finally {
      globalThis.clearTimeout(timer);
      this.controllers.delete(controller);
    }
  }

  close() {
    for (const controller of this.controllers) {
      controller.abort();
    }
  }
}

/** Independent MTProto 2.0 RPC client. Uses no Telegram client dependency. */
export class Mtproto {
  constructor({
    apiId,
    apiHash,
    dc = 2,
    test = false,
    transport,
    authKey,
    salt = 0n,
    timeOffset = 0,
    codec = new TlCodec(),
    onUpdate,
    onSession,
    timeout = 30000,
    transportFactory,
    ...transportOptions
  } = {}) {
    Object.assign(this, {
      apiId,
      apiHash,
      dc,
      test,
      codec,
      onUpdate,
      onSession,
      timeout,
      timeOffset,
    });
    this.transport =
      transport ??
      new HttpTransport({ dc, test, timeout, ...transportOptions });
    this.cipher = authKey ? new MtprotoCipher(authKey) : null;
    this.salt = salt;
    this.sequence = 0;
    this.lastId = 0n;
    this.received = new Set();
    this.acknowledgements = [];
    this.queue = Promise.resolve();
    this.updateQueue = Promise.resolve();
    this.pendingUpdates = [];
    this.initialized = false;
    this.datacenters = new DatacenterPool(
      this,
      (dc) =>
        new Mtproto({
          apiId,
          apiHash,
          dc,
          test,
          codec,
          timeout,
          ...transportOptions,
          transport: transportFactory?.(dc),
          transportFactory,
          onUpdate: (value) => this.onUpdate?.(value),
        }),
      async () => {
        await this.onSession?.(this.saveSession());
      }
    );
  }

  messageId() {
    const time = BigInt(Date.now() + this.timeOffset * 1000);
    let id = ((time * (1n << 32n)) / 1000n) & ~3n;
    if (id <= this.lastId) {
      id = this.lastId + 4n;
    }
    if (!(id & 0xffffffffn)) {
      id += 4n;
    }
    this.lastId = id;
    return id;
  }

  async plainExchange(request, options) {
    const data = this.codec.encode(request);
    const packet = Buffer.alloc(20 + data.length);
    packet.writeBigInt64LE(this.messageId(), 8);
    packet.writeInt32LE(data.length, 16);
    packet.set(data, 20);
    const response = await this.transport.request(packet, options);
    if (
      response.length < 20 ||
      response.readBigInt64LE(0) !== 0n ||
      !(response.readBigInt64LE(8) & 1n) ||
      response.readInt32LE(16) !== response.length - 20
    ) {
      throw new Error('Invalid unencrypted MTProto envelope');
    }
    return this.codec.decode(response.subarray(20));
  }

  async connect(options = {}) {
    options = deadlineOptions(options, this.timeout);
    if (this.connecting) {
      return this.connecting;
    }
    if (this.cipher) {
      return;
    }
    this.connecting = createAuthKey({
      dc: this.dc,
      test: this.test,
      codec: this.codec,
      exchange: (request) => this.plainExchange(request, options),
    }).then(async ({ authKey, salt, timeOffset }) => {
      this.cipher = new MtprotoCipher(authKey);
      this.salt = salt;
      this.timeOffset = timeOffset;
      await this.onSession?.(this.saveSession());
    });
    try {
      await this.connecting;
    } finally {
      this.connecting = null;
    }
  }

  start(options) {
    return new Authentication(this).start(options);
  }
  sendCode(phoneNumber, settings) {
    return new Authentication(this).sendCode(phoneNumber, settings);
  }
  signIn(options) {
    return new Authentication(this).signIn(options);
  }
  checkPassword(password) {
    return new Authentication(this).checkPassword(password);
  }

  saveSession() {
    return Session.fromClient(this.datacenters.home).save();
  }

  disconnect() {
    this.stopUpdates();
    return this.datacenters.close();
  }

  closeTransport() {
    this.transport.close?.();
    this.initialized = false;
    return Promise.resolve();
  }

  call(method, params = {}, options) {
    const request = objectRequest(requestOf(method, params));
    const run = () => this.datacenters.call(request, options);
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result.finally(() => {
      for (const client of this.datacenters.clients.values()) {
        client.dispatchUpdates();
      }
    });
  }

  dispatchUpdates() {
    const updates = this.pendingUpdates.splice(0);
    for (const update of updates) {
      this.updateQueue = this.updateQueue
        .then(() => this.onUpdate?.(update))
        .catch((error) => {
          this.updateError = error;
        });
    }
  }

  pollUpdates(options = {}) {
    const task = this.queue.then(async () => {
      const active = this.datacenters.home;
      await active.connect(options);
      const { response } = await active.exchange(
        this.codec.encode({
          _: 'http_wait',
          max_delay: 0,
          wait_after: 0,
          max_wait: options.maxWait ?? 25000,
        }),
        { ...deadlineOptions(options, this.timeout), content: false }
      );
      await active.processEnvelope(response, {});
      await active.flushAcknowledgements(options);
    });
    this.queue = task.catch(() => {});
    return task.finally(() => {
      for (const client of this.datacenters.clients.values()) {
        client.dispatchUpdates();
      }
    });
  }

  stopUpdates() {
    this.updatesController?.abort();
  }

  async runUpdates({
    state,
    stateStore,
    onUpdate,
    onState,
    maxPolls = Infinity,
    ...options
  } = {}) {
    if (this.updatesController) {
      throw new Error('Updates are already running');
    }
    const controller = new globalThis.AbortController();
    this.updatesController = controller;
    const signal = options.signal
      ? globalThis.AbortSignal.any([options.signal, controller.signal])
      : controller.signal;
    const previous = this.onUpdate;
    this.updateError = undefined;
    try {
      const stored = await readUpdateState(state, stateStore);
      const manager = new UpdateManager({
        ...options,
        state: stored ?? undefined,
        invoke: (method, params) => this.call(method, params, { signal }),
        onUpdate,
        onState: async (value) => {
          await stateStore?.save(
            JSON.stringify(value, (key, field) =>
              typeof field === 'bigint' ? String(field) : field
            )
          );
          await onState?.(value);
        },
      });
      this.onUpdate = (value) => manager.feed(value);
      await manager.initialize();
      for (let count = 0; count < maxPolls && !signal.aborted; count++) {
        if (!(await pollUntilStopped(this, { ...options, signal }))) {
          break;
        }
        for (const client of this.datacenters.clients.values()) {
          await client.updateQueue;
          if (client.updateError) {
            throw client.updateError;
          }
        }
      }
      return manager.state;
    } finally {
      this.onUpdate = previous;
      this.updatesController = undefined;
    }
  }

  invoke(request, options) {
    const { method, params } = requestOf(request);
    return this.call(method, params, options);
  }

  async exchange(body, { content = true, ...options } = {}) {
    options.signal?.throwIfAborted();
    const messageId = this.messageId();
    const sequence = this.sequence * 2 + (content ? 1 : 0);
    if (content) {
      this.sequence++;
    }
    const packet = this.cipher.encrypt(body, {
      messageId,
      sequence,
      salt: this.salt,
    });
    return {
      messageId,
      response: await this.transport.request(packet, options),
    };
  }

  acceptId(id) {
    const timestamp = Number(id >> 32n);
    const now = Date.now() / 1000 + this.timeOffset;
    if (!(id & 1n) || timestamp > now + 30 || timestamp < now - 300) {
      throw new Error('Invalid MTProto server message ID');
    }
    if (this.received.has(id)) {
      return false;
    }
    if (this.received.size >= 1000) {
      const minimum = [...this.received].reduce((left, right) =>
        left < right ? left : right
      );
      if (id < minimum) {
        return false;
      }
      this.received.delete(minimum);
    }
    this.received.add(id);
    return true;
  }

  async processEnvelope(packet, pending) {
    const envelope = this.cipher.decrypt(packet);
    if (!this.acceptId(envelope.messageId)) {
      return;
    }
    if (envelope.sequence & 1) {
      this.acknowledgements.push(envelope.messageId);
    }
    await this.processBody(envelope.body, pending, 0);
  }

  async processBody(bytes, pending, depth) {
    if (depth > this.codec.maxDepth) {
      throw new RangeError('MTProto container depth exceeded');
    }
    const reader = new TlReader(this.codec, bytes);
    const id = reader.number(4, 'getUint32');
    if (id === 0x73f1f8dc) {
      await this.processContainer(reader, pending, depth);
    } else if (id === 0x3072cfa1) {
      await this.processBody(
        gunzipSync(reader.byteString(), {
          maxOutputLength: this.codec.maxBytes,
        }),
        pending,
        depth + 1
      );
    } else if (id === 0xf35c6d01) {
      const requestId = reader.number(8, 'getBigInt64');
      if (requestId !== pending.id) {
        return;
      }
      pending.value = this.readResult(
        reader.take(bytes.length - reader.offset),
        pending.type
      );
      pending.done = true;
    } else {
      await this.processService(this.codec.decode(bytes), pending);
    }
  }

  async processContainer(reader, pending, depth) {
    const count = reader.number(4, 'getInt32');
    if (count < 0 || count > 1000) {
      throw new RangeError('Invalid MTProto container count');
    }
    for (let index = 0; index < count; index++) {
      const messageId = reader.number(8, 'getBigInt64');
      const sequence = reader.number(4, 'getInt32');
      const length = reader.number(4, 'getInt32');
      if (sequence < 0 || length % 4) {
        throw new RangeError('Invalid MTProto container message');
      }
      const body = reader.take(length);
      if (!this.acceptId(messageId)) {
        continue;
      }
      if (sequence & 1) {
        this.acknowledgements.push(messageId);
      }
      await this.processBody(body, pending, depth + 1);
    }
    if (reader.offset !== reader.bytes.length) {
      throw new RangeError('Trailing bytes in MTProto container');
    }
  }

  async flushAcknowledgements(options) {
    const ids = [...new Set(this.acknowledgements.splice(0, 1000))];
    if (!ids.length) {
      return;
    }
    try {
      const { response } = await this.exchange(
        this.codec.encode({ _: 'msgs_ack', msg_ids: ids }),
        { ...options, content: false }
      );
      await this.processEnvelope(response, {});
    } catch {
      // Acknowledgements can be retried safely. Do not turn a completed RPC
      // into an apparent failure that could make an application resend it.
      this.acknowledgements.unshift(...ids);
    }
  }

  processService(value, pending) {
    if (value._ === 'bad_server_salt' && value.bad_msg_id === pending.id) {
      this.salt = value.new_server_salt;
      pending.retry = true;
    } else if (
      value._ === 'bad_msg_notification' &&
      value.bad_msg_id === pending.id
    ) {
      throw new TelegramError('MTProto rejected message', {
        code: value.error_code,
        type: 'BAD_MSG_NOTIFICATION',
      });
    } else if (value._ === 'new_session_created') {
      this.salt = value.server_salt;
      this.pendingUpdates.push(value);
    } else if (!['msgs_ack', 'msgs_state_info', 'pong'].includes(value._)) {
      if (this.pendingUpdates.length >= 1000) {
        throw new RangeError('MTProto pending update limit exceeded');
      }
      this.pendingUpdates.push(value);
    }
  }

  readResult(bytes, type, depth = 0) {
    if (depth > this.codec.maxDepth) {
      throw new RangeError('MTProto gzip depth exceeded');
    }
    const reader = new TlReader(this.codec, bytes);
    const id = reader.number(4, 'getUint32');
    if (id === 0x3072cfa1) {
      return this.readResult(
        gunzipSync(reader.byteString(), {
          maxOutputLength: this.codec.maxBytes,
        }),
        type,
        depth + 1
      );
    }
    if (id === 0x2144ca19) {
      const error = this.codec.decode(bytes);
      throw TelegramError.from(
        { code: error.error_code, error_message: error.error_message },
        'native'
      );
    }
    return this.codec.decode(bytes, type);
  }

  async rpc(request, options = {}) {
    if (!this.codec.methods.has(request._)) {
      throw new TypeError(`Unknown Telegram RPC ${request._}`);
    }
    options = deadlineOptions(options, this.timeout);
    await this.connect(options);
    options.signal.throwIfAborted();
    await this.flushAcknowledgements(options);
    let body = request;
    if (!this.initialized && this.apiId) {
      body = {
        _: 'invokeWithLayer',
        layer: this.codec.layer,
        query: {
          _: 'initConnection',
          api_id: this.apiId,
          device_model: 'Anygram',
          system_version: 'JavaScript',
          app_version: '0.5.0',
          system_lang_code: 'en',
          lang_pack: '',
          lang_code: 'en',
          query: request,
        },
      };
    }
    const deadline = Date.now() + (options.timeout ?? this.timeout);
    for (let retry = 0; retry < 3; retry++) {
      const { messageId, response } = await this.exchange(
        this.codec.encode(body),
        options
      );
      const pending = {
        id: messageId,
        type: this.codec.methods.get(request._).type,
      };
      for (let polls = 0; polls < 100; polls++) {
        await this.processEnvelope(
          polls === 0
            ? response
            : (
                await this.exchange(
                  this.codec.encode({
                    _: 'http_wait',
                    max_delay: 0,
                    wait_after: 0,
                    max_wait: 1000,
                  }),
                  { ...options, content: false }
                )
              ).response,
          pending
        );
        if (pending.done) {
          this.initialized = true;
          await this.flushAcknowledgements(options);
          return pending.value;
        }
        if (pending.retry) {
          break;
        }
        if (Date.now() > deadline || options.signal?.aborted) {
          throw new TelegramError('MTProto response timed out or cancelled', {
            type: 'TIMEOUT',
          });
        }
      }
      if (!pending.retry) {
        throw new TelegramError('MTProto response poll limit exceeded', {
          type: 'TIMEOUT',
        });
      }
    }
    throw new TelegramError('MTProto salt retry limit exceeded');
  }
}

function deadlineOptions(options, defaultTimeout) {
  const timeout = options.timeout ?? defaultTimeout;
  if (!Number.isFinite(timeout) || timeout <= 0) {
    throw new RangeError('Invalid MTProto timeout');
  }
  const timeoutSignal = globalThis.AbortSignal.timeout(timeout);
  options = {
    ...options,
    signal: options.signal
      ? globalThis.AbortSignal.any([options.signal, timeoutSignal])
      : timeoutSignal,
  };
  options.signal.throwIfAborted();

  return options;
}

async function readUpdateState(state, store) {
  if (state) {
    return state;
  }
  return store ? JSON.parse((await store.load()) || 'null') : undefined;
}

async function pollUntilStopped(client, options) {
  try {
    await client.pollUpdates(options);
    return true;
  } catch (error) {
    if (options.signal.aborted && error === options.signal.reason) {
      return false;
    }
    throw error;
  }
}
