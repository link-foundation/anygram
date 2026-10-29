import { SecretChatCipher, decryptSecretVersions } from './secret-cipher.js';
import { SecretChatCodec } from './secret-codec.js';
import { SecretChatSequence } from './secret-sequence.js';
import { SecretChatLayers } from './secret-layers.js';
import { secretLimit, secretCounter } from './secret-sequence-state.js';
import {
  secretChatId,
  secretLong,
  secretDecodedBytes,
} from './secret-handshake-state.js';
import { TelegramError } from './errors.js';
import { randomId } from './random.js';

const base64 = (bytes) => Buffer.from(bytes).toString('base64');
const effects = () => ({ messages: [], aborted: false });

export function secretSessionLimits(options) {
  return {
    maxPending: secretLimit(
      options.maxPending ?? 1000,
      1,
      10000,
      'pending limit'
    ),
    maxHistory: secretLimit(
      options.maxHistory ?? 1000,
      1,
      10000,
      'history limit'
    ),
    maxBufferedBytes: secretLimit(
      options.maxBufferedBytes ?? 16 * 1024 * 1024,
      256,
      64 * 1024 * 1024,
      'session byte limit'
    ),
  };
}

function peerOf(peer) {
  if (peer?._ !== 'inputEncryptedChat') {
    throw new TypeError('Expected an InputEncryptedChat');
  }
  return {
    _: 'inputEncryptedChat',
    chat_id: secretChatId(peer.chat_id),
    access_hash: secretLong(peer.access_hash, 'access hash'),
  };
}

/** Owned working state. A controller commits a copy only after durable saving. */
export class SecretSessionState {
  constructor(options, limits) {
    this.limits = limits;
    this.outbox = new Map();
    this.incomingVersions = new Map();
    this.ciphers = [];
    const state = options.state;
    if (
      state &&
      (state.version !== 1 || !['active', 'aborted'].includes(state.phase))
    ) {
      throw new TypeError('Invalid secret chat session state');
    }
    this.originator = state ? state.originator : options.originator;
    if (typeof this.originator !== 'boolean') {
      throw new TypeError('Secret chat originator must be specified');
    }
    this.peer = peerOf(state ? state.peer : options.peer);
    this.phase = state?.phase ?? 'active';
    this.discardSubmitted = state ? state.discardSubmitted : false;
    if (typeof this.discardSubmitted !== 'boolean') {
      throw new TypeError('Invalid secret chat discard state');
    }
    try {
      if (this.phase === 'active') {
        this.initialize(options, state);
      } else {
        this.restoreAborted(state);
      }
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  initialize(options, state) {
    if (state && (!state.layers || !state.sequence)) {
      throw new TypeError('Missing secret chat active state');
    }
    this.layers = new SecretChatLayers({
      layer: state ? state.layers?.localLayer : options.layer,
      remoteLayer: options.remoteLayer,
      state: state?.layers,
    });
    const layer = this.layers.outgoing.layer;
    this.sequence = new SecretChatSequence({
      ...this.limits,
      originator: this.originator,
      layer,
      state: state?.sequence,
    });
    this.codec = new SecretChatCodec({
      layer: 216,
      maxBytes: Math.min(this.limits.maxBufferedBytes, 16 * 1024 * 1024),
    });
    if (state) {
      this.key = secretDecodedBytes(state.key, 256, 256, 'session key');
    } else {
      if (!(options.key instanceof Uint8Array) || options.key.length !== 256) {
        throw new RangeError('Secret chat key must contain 256 bytes');
      }
      this.key = Buffer.from(options.key);
    }
    for (const version of [1, 2]) {
      this.ciphers[version] = new SecretChatCipher(this.key, {
        originator: this.originator,
        version,
        maxBytes: this.codec.maxBytes,
      });
    }
    if (this.discardSubmitted) {
      throw new TypeError('Active secret chat cannot have a submitted discard');
    }
    if (state) {
      this.restoreOutbox(state);
      this.restoreIncomingVersions(state);
    }
  }

  restoreAborted(state) {
    if (
      state.key !== null ||
      state.layers !== null ||
      state.sequence !== null ||
      !Array.isArray(state.outbox) ||
      state.outbox.length !== 0 ||
      !Array.isArray(state.incomingVersions) ||
      state.incomingVersions.length !== 0
    ) {
      throw new TypeError('Aborted secret chat retains private state');
    }
  }

  frameBytes(frame) {
    return new SecretChatCodec({
      layer: frame.layer,
      maxBytes: this.codec.maxBytes,
    }).encode(frame, 'DecryptedMessageLayer');
  }

  history() {
    return this.sequence.retained();
  }

  restoreOutbox(state) {
    const history = this.history();
    if (
      !Array.isArray(state.outbox) ||
      state.outbox.length !== history.length
    ) {
      throw new RangeError('Invalid secret chat outbox coverage');
    }
    const readers = [];
    try {
      for (const version of [1, 2]) {
        readers[version] = new SecretChatCipher(this.key, {
          originator: !this.originator,
          version,
          maxBytes: this.codec.maxBytes,
        });
      }
      let remaining =
        this.limits.maxBufferedBytes - this.sequence.state.bufferedBytes;
      for (const [index, entry] of state.outbox.entries()) {
        const frame = history[index];
        if (
          entry.outSequence !== frame.out_seq_no ||
          entry.version !== (frame.layer >= 73 ? 2 : 1) ||
          typeof entry.submitted !== 'boolean'
        ) {
          throw new TypeError('Invalid secret chat outbox entry');
        }
        const data = secretDecodedBytes(
          entry.data,
          40,
          Math.min(remaining, this.codec.maxBytes + 1052),
          'outgoing packet'
        );
        this.outbox.set(entry.outSequence, {
          version: entry.version,
          submitted: entry.submitted,
          data,
        });
        remaining -= data.length;
        const body = readers[entry.version].decrypt(data);
        let expected;
        try {
          expected = this.frameBytes(frame);
          if (Buffer.compare(body, expected) !== 0) {
            throw new Error('Secret chat outbox plaintext mismatch');
          }
        } finally {
          body.fill(0);
          expected?.fill(0);
        }
      }
    } finally {
      for (const reader of readers) {
        reader?.destroy();
      }
    }
    this.checkBounds();
  }

  restoreIncomingVersions(state) {
    const pending = new Map(
      this.sequence.pendingFrames().map((frame) => [frame.out_seq_no, frame])
    );
    if (
      !Array.isArray(state.incomingVersions) ||
      state.incomingVersions.length !== pending.size
    ) {
      throw new RangeError('Invalid secret chat pending envelope coverage');
    }
    const policy = new SecretChatLayers({
      layer: state.layers.localLayer,
      state: state.layers,
    });
    for (const entry of state.incomingVersions) {
      if (
        !Array.isArray(entry) ||
        entry.length !== 2 ||
        !pending.has(entry[0]) ||
        this.incomingVersions.has(entry[0]) ||
        ![1, 2].includes(entry[1])
      ) {
        throw new TypeError('Invalid secret chat pending envelope version');
      }
      policy.observe(pending.get(entry[0]), entry[1], { ordered: false });
      this.incomingVersions.set(...entry);
    }
    if (
      JSON.stringify(policy.exportState()) !==
      JSON.stringify(this.layers.exportState())
    ) {
      throw new TypeError('Inconsistent secret chat pending envelope policy');
    }
  }

  assertActive() {
    if (this.phase !== 'active') {
      throw new TelegramError('Secret chat session is aborted', {
        type: 'SECRET_CHAT_ABORTED',
      });
    }
  }

  bufferedBytes() {
    let bytes = this.sequence.state.bufferedBytes;
    for (const { data } of this.outbox.values()) {
      bytes += data.length;
    }
    return bytes;
  }

  checkBounds() {
    if (this.bufferedBytes() > this.limits.maxBufferedBytes) {
      throw new RangeError('Secret chat session buffer byte limit exceeded');
    }
  }

  pruneOutbox() {
    const retained = new Set(this.history().map((frame) => frame.out_seq_no));
    for (const [wire, packet] of this.outbox) {
      if (!retained.has(wire)) {
        packet.data.fill(0);
        this.outbox.delete(wire);
      }
    }
  }

  synchronize() {
    this.pruneOutbox();
    if (
      this.bufferedBytes() > this.limits.maxBufferedBytes &&
      this.sequence.pruneAcknowledged()
    ) {
      this.pruneOutbox();
    }
    this.checkBounds();
  }

  encrypt(frame, version) {
    const body = this.frameBytes(frame);
    let data;
    try {
      data = this.ciphers[version].encrypt(body);
    } finally {
      body.fill(0);
    }
    this.outbox.get(frame.out_seq_no)?.data.fill(0);
    this.outbox.set(frame.out_seq_no, { version, submitted: false, data });
    this.synchronize();
  }

  queue(message) {
    this.assertActive();
    if (
      this.history().some(
        (frame) => frame.message.random_id === message.random_id
      )
    ) {
      throw new RangeError('Duplicate secret chat outgoing random ID');
    }
    this.sequence.upgradeLayer(this.layers.outgoing.layer);
    const frame = this.sequence.create(message);
    this.encrypt(frame, this.layers.outgoing.version);
    return frame;
  }

  notify() {
    this.assertActive();
    if (!this.layers.needsNotification) {
      return undefined;
    }
    const frame = this.queue({
      _: 'decryptedMessageService',
      random_id: randomId(),
      action: this.layers.notification(),
    });
    this.layers.markNotified();
    return frame;
  }

  decrypt(data) {
    return decryptSecretVersions(this.ciphers, data);
  }

  receive(data) {
    this.assertActive();
    const { body, version } = this.decrypt(data);
    try {
      return this.receiveFrame(
        this.codec.decode(body, 'DecryptedMessageLayer'),
        version
      );
    } catch (cause) {
      throw new TelegramError('Invalid authenticated secret chat message', {
        type: 'SECRET_CHAT_ABORTED',
        cause,
      });
    } finally {
      body.fill(0);
    }
  }

  receiveFrame(frame, version) {
    const output = this.sequence.receive(frame);
    if (output.duplicate || output.ignored) {
      return output;
    }
    this.layers.observe(frame, version, { ordered: false });
    this.incomingVersions.set(frame.out_seq_no, version);
    for (const ordered of output.messages) {
      this.layers.observe(
        ordered,
        this.incomingVersions.get(ordered.out_seq_no)
      );
    }
    for (const wire of this.incomingVersions.keys()) {
      if (
        secretCounter(wire, this.originator ? 0 : 1) <
        this.sequence.state.incoming
      ) {
        this.incomingVersions.delete(wire);
      }
    }
    this.sequence.upgradeLayer(this.layers.outgoing.layer);
    for (const retransmit of output.retransmit) {
      const packet = this.outbox.get(retransmit.out_seq_no);
      if (!packet) {
        throw new Error('Missing secret chat retransmission packet');
      }
      packet.submitted = false;
    }
    if (output.resend) {
      this.notify();
      this.queue({
        _: 'decryptedMessageService',
        random_id: randomId(),
        action: output.resend,
      });
    }
    this.synchronize();
    return output;
  }

  pending() {
    if (this.phase !== 'active') {
      return [];
    }
    return this.history()
      .filter((frame) => !this.outbox.get(frame.out_seq_no).submitted)
      .map((frame) => {
        const packet = this.outbox.get(frame.out_seq_no);
        return {
          outSequence: frame.out_seq_no,
          version: packet.version,
          request: {
            _:
              frame.message._ === 'decryptedMessageService'
                ? 'messages.sendEncryptedService'
                : 'messages.sendEncrypted',
            peer: { ...this.peer },
            random_id: frame.message.random_id,
            data: Uint8Array.from(packet.data),
          },
        };
      });
  }

  exportState() {
    return {
      version: 1,
      phase: this.phase,
      originator: this.originator,
      peer: { ...this.peer, access_hash: String(this.peer.access_hash) },
      discardSubmitted: this.discardSubmitted,
      key: this.phase === 'active' ? base64(this.key) : null,
      layers: this.phase === 'active' ? this.layers.exportState() : null,
      sequence: this.phase === 'active' ? this.sequence.exportState() : null,
      outbox: [...this.outbox].map(([outSequence, packet]) => ({
        outSequence,
        version: packet.version,
        submitted: packet.submitted,
        data: base64(packet.data),
      })),
      incomingVersions: [...this.incomingVersions].map((entry) => [...entry]),
    };
  }

  abort() {
    this.destroy();
    this.phase = 'aborted';
    return { ...effects(), aborted: true };
  }

  destroy() {
    this.key?.fill(0);
    this.sequence?.destroy();
    for (const cipher of this.ciphers) {
      cipher?.destroy();
    }
    for (const packet of this.outbox.values()) {
      packet.data.fill(0);
    }
    this.outbox.clear();
    this.incomingVersions.clear();
  }
}
