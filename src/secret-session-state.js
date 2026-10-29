import { SecretSessionKeys } from './secret-session-keys.js';
import {
  restoreSecretOutbox,
  secretPacketDigest,
  secretDeletionFrame,
} from './secret-session-outbox.js';
import { SecretChatCodec } from './secret-codec.js';
import { SecretChatSequence } from './secret-sequence.js';
import { SecretChatLayers } from './secret-layers.js';
import { secretLimit, secretCounter } from './secret-sequence-state.js';
import { secretChatId, secretLong } from './secret-handshake-state.js';
import { TelegramError } from './errors.js';
import { randomId } from './random.js';
import {
  encodeSecretAttachment,
  decodeSecretAttachment,
  restoreSecretAttachment,
  secretMessageForLayer,
} from './secret-attachments.js';

const base64 = (bytes) => Buffer.from(bytes).toString('base64');
const effects = () => ({ messages: [], aborted: false });

function pendingPair(entry, pending, seen) {
  if (
    !Array.isArray(entry) ||
    entry.length !== 2 ||
    !pending.has(entry[0]) ||
    seen.has(entry[0])
  ) {
    throw new TypeError('Invalid secret chat pending metadata pair');
  }
}

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
    this.incomingKeys = new Map();
    this.incomingFiles = new Map();
    const state = options.state;
    if (
      state !== undefined &&
      (!state ||
        ![1, 2].includes(state.version) ||
        !['active', 'aborted'].includes(state.phase))
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
    this.keys = new SecretSessionKeys({
      ...options,
      state,
      originator: this.originator,
      maxBytes: this.codec.maxBytes,
    });
    if (this.discardSubmitted) {
      throw new TypeError('Active secret chat cannot have a submitted discard');
    }
    if (state) {
      restoreSecretOutbox(this, state);
      this.restoreIncomingVersions(state);
      this.restoreIncomingKeys(state);
      this.restoreIncomingFiles(state);
      this.checkBounds();
    }
  }

  restoreAborted(state) {
    this.restoreIncomingFiles(state);
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
    if (
      state.version === 2 &&
      (state.keyState !== null ||
        state.rekey !== null ||
        !Array.isArray(state.incomingKeys) ||
        state.incomingKeys.length)
    ) {
      throw new TypeError('Aborted secret chat retains key-transition state');
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
      pendingPair(entry, pending, this.incomingVersions);
      if (![1, 2].includes(entry[1])) {
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

  restoreIncomingKeys(state) {
    const pending = new Map(
      this.sequence.pendingFrames().map((frame) => [frame.out_seq_no, frame])
    );
    const entries =
      state.version === 1
        ? [...pending.keys()].map((wire) => [
            wire,
            String(this.keys.ring.state.currentFingerprint),
          ])
        : state.incomingKeys;
    if (!Array.isArray(entries) || entries.length !== pending.size) {
      throw new RangeError('Invalid secret chat pending key coverage');
    }
    if (state.version === 1 && this.sequence.state.incoming > 0) {
      this.keys.ring.observe(
        this.keys.ring.state.currentFingerprint,
        this.sequence.state.incoming - 1
      );
    }
    const before = this.keys.ring.exportState();
    for (const entry of entries) {
      pendingPair(entry, pending, this.incomingKeys);
      const fingerprint = secretLong(entry[1], 'pending fingerprint');
      this.keys.ring.observe(
        fingerprint,
        secretCounter(entry[0], this.originator ? 0 : 1)
      );
      this.incomingKeys.set(entry[0], fingerprint);
    }
    if (
      state.version === 2 &&
      JSON.stringify(before) !== JSON.stringify(this.keys.ring.exportState())
    ) {
      throw new TypeError('Inconsistent secret chat pending key policy');
    }
    this.validateKeyObservations(pending);
  }

  validateKeyObservations(pending) {
    const maximum = Math.max(
      this.sequence.state.incoming - 1,
      ...[...pending.keys()].map((wire) =>
        secretCounter(wire, this.originator ? 0 : 1)
      )
    );
    const keys = this.keys.ring.state;
    if (
      keys.highestCurrentSequence > maximum ||
      keys.highestPreviousSequence > maximum
    ) {
      throw new RangeError(
        'Secret chat key observation exceeds accepted sequence'
      );
    }
  }

  restoreIncomingFiles(state) {
    const pending = new Map(
      (this.sequence?.pendingFrames() ?? []).map((frame) => [
        frame.out_seq_no,
        frame,
      ])
    );
    const entries =
      state.incomingFiles === undefined ? [] : state.incomingFiles;
    if (!Array.isArray(entries) || entries.length > pending.size) {
      throw new RangeError('Invalid secret chat pending file coverage');
    }
    for (const entry of entries) {
      if (!Array.isArray(entry) || entry.length !== 3) {
        throw new TypeError('Invalid secret chat pending file tuple');
      }
      pendingPair(entry.slice(0, 2), pending, this.incomingFiles);
      const file = restoreSecretAttachment(
        pending.get(entry[0]).message,
        entry[1],
        true
      );
      if (!file) {
        throw new TypeError('Missing pending secret file attachment');
      }
      if (entry[2] !== this.attachmentDigest(pending.get(entry[0]), file)) {
        file.fill(0);
        throw new TypeError('Secret chat pending file digest mismatch');
      }
      this.incomingFiles.set(entry[0], file);
    }
    for (const frame of pending.values()) {
      if (!this.incomingFiles.has(frame.out_seq_no)) {
        encodeSecretAttachment(frame.message, undefined, true);
      }
    }
  }

  attachmentDigest(frame, file) {
    const body = this.frameBytes(frame);
    try {
      return secretPacketDigest(body, file);
    } finally {
      body.fill(0);
    }
  }

  exportIncomingFiles() {
    if (!this.incomingFiles.size) {
      return [];
    }
    const pending = new Map(
      this.sequence.pendingFrames().map((frame) => [frame.out_seq_no, frame])
    );
    return [...this.incomingFiles].map(([wire, file]) => [
      wire,
      base64(file),
      this.attachmentDigest(pending.get(wire), file),
    ]);
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
    for (const { data, replacement, file } of this.outbox.values()) {
      bytes +=
        data.length + (replacement?.data.length ?? 0) + (file?.length ?? 0);
    }
    for (const file of this.incomingFiles.values()) {
      bytes += file.length;
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
        packet.replacement?.data.fill(0);
        packet.file?.fill(0);
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

  encryptedPacket(frame, version, file) {
    const body = this.frameBytes(frame);
    let data;
    let digest;
    try {
      data = this.keys.ring.encrypt(body, version);
      digest = secretPacketDigest(body, data, file);
    } finally {
      body.fill(0);
    }
    return { data, digest };
  }

  encrypt(frame, version, file = null) {
    const packet = this.encryptedPacket(frame, version, file);
    try {
      packet.replacement =
        this.keys.rekey && frame.message._ === 'decryptedMessage'
          ? this.encryptedPacket(secretDeletionFrame(frame), version)
          : null;
    } catch (error) {
      packet.data.fill(0);
      throw error;
    }
    const previous = this.outbox.get(frame.out_seq_no);
    previous?.data.fill(0);
    previous?.replacement?.data.fill(0);
    previous?.file?.fill(0);
    this.outbox.set(frame.out_seq_no, {
      version,
      submitted: false,
      file,
      ...packet,
    });
    this.synchronize();
  }

  replaceDeleted(frame, version) {
    const packet = this.outbox.get(frame.out_seq_no);
    if (!packet.replacement) {
      this.encrypt(frame, version);
      return;
    }
    // Preparing this ciphertext before key erasure preserves the original
    // sequence and key boundary without retaining previous keys.
    packet.data.fill(0);
    packet.file?.fill(0);
    this.outbox.set(frame.out_seq_no, {
      version,
      submitted: false,
      ...packet.replacement,
      replacement: null,
      file: null,
    });
    this.synchronize();
  }

  queue(message, inputFile) {
    this.assertActive();
    if (
      this.history().some(
        (frame) => frame.message.random_id === message.random_id
      )
    ) {
      throw new RangeError('Duplicate secret chat outgoing random ID');
    }
    this.sequence.upgradeLayer(this.layers.outgoing.layer);
    const outgoing = secretMessageForLayer(message, this.layers.outgoing.layer);
    const file = encodeSecretAttachment(outgoing, inputFile);
    try {
      const frame = this.sequence.create(outgoing);
      this.encrypt(frame, this.layers.outgoing.version, file);
      this.keys.recordSent();
      return frame;
    } catch (error) {
      file?.fill(0);
      throw error;
    }
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

  queueAction(action) {
    this.notify();
    return this.queue({
      _: 'decryptedMessageService',
      random_id: randomId(),
      action,
    });
  }

  rotateIfNeeded() {
    this.keys.maybeRotate((action) => this.queueAction(action));
  }

  rotateKey(exchangeId) {
    this.assertActive();
    this.keys.rotate(exchangeId, (action) => this.queueAction(action));
  }

  receive(data, file) {
    this.assertActive();
    const { body, version, fingerprint, candidate } = this.keys.decrypt(data);
    try {
      return this.receiveFrame(
        this.codec.decode(body, 'DecryptedMessageLayer'),
        version,
        fingerprint,
        candidate,
        file
      );
    } catch (cause) {
      if (cause.type === 'SECRET_CHAT_FILE_INVALID') {
        throw cause;
      }
      throw new TelegramError('Invalid authenticated secret chat message', {
        type: 'SECRET_CHAT_ABORTED',
        cause,
      });
    } finally {
      body.fill(0);
    }
  }

  receiveFrame(frame, version, fingerprint, candidate, inputFile) {
    const output = this.sequence.receive(frame);
    if (output.duplicate || output.ignored) {
      return output;
    }
    const file = encodeSecretAttachment(frame.message, inputFile, true);
    if (file) {
      this.incomingFiles.set(frame.out_seq_no, file);
    }
    this.layers.observe(frame, version, { ordered: false });
    this.incomingVersions.set(frame.out_seq_no, version);
    this.incomingKeys.set(frame.out_seq_no, fingerprint);
    const queue = (action) => this.queueAction(action);
    this.keys.observe(frame, fingerprint, candidate, queue);
    for (const ordered of output.messages) {
      this.layers.observe(
        ordered,
        this.incomingVersions.get(ordered.out_seq_no)
      );
      this.keys.ordered(ordered, queue);
      const attachment = this.incomingFiles.get(ordered.out_seq_no);
      if (attachment) {
        ordered.file = decodeSecretAttachment(attachment, true);
      }
    }
    for (const wire of this.incomingVersions.keys()) {
      if (
        secretCounter(wire, this.originator ? 0 : 1) <
        this.sequence.state.incoming
      ) {
        this.incomingVersions.delete(wire);
        this.incomingKeys.delete(wire);
        this.incomingFiles.get(wire)?.fill(0);
        this.incomingFiles.delete(wire);
      }
    }
    this.keys.ring.retire(this.sequence.state.incoming);
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
    this.rotateIfNeeded();
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
                : packet.file
                  ? 'messages.sendEncryptedFile'
                  : 'messages.sendEncrypted',
            peer: { ...this.peer },
            random_id: frame.message.random_id,
            data: Uint8Array.from(packet.data),
            ...(packet.file
              ? { file: decodeSecretAttachment(packet.file) }
              : {}),
          },
        };
      });
  }

  receiptEffects(outSequence, value) {
    const packet = this.outbox.get(outSequence);
    if (!packet.file) {
      return {};
    }
    const frame = this.history().find(
      (entry) => entry.out_seq_no === outSequence
    );
    const bytes = encodeSecretAttachment(frame.message, value.file, true);
    try {
      return {
        files: [
          {
            outSequence,
            randomId: frame.message.random_id,
            file: decodeSecretAttachment(bytes, true),
          },
        ],
      };
    } finally {
      bytes.fill(0);
    }
  }

  exportState() {
    return {
      version: 2,
      phase: this.phase,
      originator: this.originator,
      peer: { ...this.peer, access_hash: String(this.peer.access_hash) },
      discardSubmitted: this.discardSubmitted,
      ...(this.phase === 'active'
        ? this.keys.exportState()
        : { key: null, keyState: null, rekey: null }),
      layers: this.phase === 'active' ? this.layers.exportState() : null,
      sequence: this.phase === 'active' ? this.sequence.exportState() : null,
      outbox: [...this.outbox].map(([outSequence, packet]) => ({
        outSequence,
        version: packet.version,
        submitted: packet.submitted,
        data: base64(packet.data),
        digest: packet.digest,
        replacement: packet.replacement
          ? {
              data: base64(packet.replacement.data),
              digest: packet.replacement.digest,
            }
          : null,
        file: packet.file ? base64(packet.file) : null,
      })),
      incomingVersions: [...this.incomingVersions].map((entry) => [...entry]),
      incomingKeys: [...this.incomingKeys].map(([wire, fingerprint]) => [
        wire,
        String(fingerprint),
      ]),
      incomingFiles: this.exportIncomingFiles(),
    };
  }

  abort() {
    this.destroy();
    this.phase = 'aborted';
    return { ...effects(), aborted: true };
  }

  destroy() {
    this.keys?.destroy();
    this.sequence?.destroy();
    for (const packet of this.outbox.values()) {
      packet.data?.fill(0);
      packet.replacement?.data.fill(0);
      packet.file?.fill(0);
    }
    this.outbox.clear();
    this.incomingVersions.clear();
    this.incomingKeys.clear();
    for (const file of this.incomingFiles.values()) {
      file.fill(0);
    }
    this.incomingFiles.clear();
  }
}
