import { randomBytes } from 'node:crypto';
import { SecretChatCodec } from './secret-codec.js';
import { TelegramError } from './errors.js';
import { randomId } from './random.js';
import {
  MAX_SECRET_COUNTER as MAX_COUNTER,
  secretLimit as limit,
  secretCounter,
  isSecretResend as isResend,
  secretDeletionMessage,
  restoreSecretSequence,
} from './secret-sequence-state.js';

const result = () => ({
  messages: [],
  retransmit: [],
  resend: undefined,
  duplicate: false,
  ignored: false,
});

/** Synchronous ordered-delivery state; persist before acknowledging or sending. */
export class SecretChatSequence {
  #originator;
  #codec;
  #readCodec;
  #incoming = 0;
  #outgoing = 0;
  #acknowledged = 0;
  #pending = new Map();
  #history = new Map();
  #bufferedBytes = 0;
  #requestedUntil;
  #failure;
  #maxPending;
  #maxHistory;
  #maxBufferedBytes;

  constructor({
    originator,
    layer = 144,
    maxPending = 1000,
    maxHistory = 1000,
    maxBufferedBytes = 16 * 1024 * 1024,
    state,
  } = {}) {
    if (typeof originator !== 'boolean') {
      throw new TypeError('Secret chat originator must be specified');
    }
    limit(layer, 17, 216, 'layer');
    this.#maxPending = limit(maxPending, 1, 10000, 'pending limit');
    this.#maxHistory = limit(maxHistory, 1, 10000, 'history limit');
    this.#maxBufferedBytes = limit(
      maxBufferedBytes,
      256,
      64 * 1024 * 1024,
      'buffer byte limit'
    );
    this.#codec = new SecretChatCodec({
      layer,
      maxBytes: Math.min(maxBufferedBytes, 16 * 1024 * 1024),
    });
    this.#readCodec = new SecretChatCodec({
      layer: 216,
      maxBytes: this.#codec.maxBytes,
    });
    this.#originator = originator;
    if (state !== undefined) {
      const restored = restoreSecretSequence(state, {
        originator,
        layer,
        codec: this.#readCodec,
        maxHistory,
        maxPending,
        maxBytes: maxBufferedBytes,
      });
      this.#incoming = state.incoming;
      this.#outgoing = state.outgoing;
      this.#acknowledged = state.acknowledged;
      this.#history = restored.history;
      this.#pending = restored.pending;
      this.#bufferedBytes = restored.bufferedBytes;
      this.#requestedUntil = restored.requestedUntil;
    }
  }

  get state() {
    return {
      incoming: this.#incoming,
      outgoing: this.#outgoing,
      acknowledged: this.#acknowledged,
      pending: this.#pending.size,
      history: this.#history.size,
      bufferedBytes: this.#bufferedBytes,
      aborted: Boolean(this.#failure),
    };
  }

  #assertActive() {
    if (this.#failure) {
      throw this.#failure;
    }
  }

  /** Change future serialization only; cached frames retain their original layer. */
  upgradeLayer(layer) {
    this.#assertActive();
    limit(layer, this.#codec.layer, 216, 'layer upgrade');
    this.#codec = new SecretChatCodec({
      layer,
      maxBytes: this.#codec.maxBytes,
    });
  }

  #abort(message, cause) {
    this.destroy();
    this.#failure = new TelegramError(message, {
      type: 'SECRET_CHAT_ABORTED',
      cause,
    });
    throw this.#failure;
  }

  #decode(bytes) {
    return this.#readCodec.decode(bytes, 'DecryptedMessageLayer');
  }

  #reserve(bytes, additionalEntries = 1) {
    let count = this.#history.size;
    let buffered = this.#bufferedBytes;
    const entries = this.#history.entries();
    const evicted = [];
    while (
      count + additionalEntries > this.#maxHistory ||
      buffered + bytes > this.#maxBufferedBytes
    ) {
      const entry = entries.next().value;
      if (!entry || entry[0] >= this.#acknowledged) {
        throw new RangeError(
          'Secret chat history limit or buffer byte limit exceeded'
        );
      }
      evicted.push(entry);
      count--;
      buffered -= entry[1].length;
    }
    for (const [index, cached] of evicted) {
      this.#history.delete(index);
      this.#bufferedBytes -= cached.length;
      cached.fill(0);
    }
  }

  #encodeNext(message) {
    if (this.#outgoing >= MAX_COUNTER) {
      throw new RangeError('Secret chat sequence counter exhausted');
    }
    return this.#codec.encode(
      {
        _: 'decryptedMessageLayer',
        random_bytes: randomBytes(16),
        layer: this.#codec.layer,
        in_seq_no: 2 * this.#incoming + (this.#originator ? 0 : 1),
        out_seq_no: 2 * this.#outgoing + (this.#originator ? 1 : 0),
        message,
      },
      'DecryptedMessageLayer'
    );
  }

  create(message) {
    this.#assertActive();
    const bytes = this.#encodeNext(message);
    this.#reserve(bytes.length);
    this.#history.set(this.#outgoing++, bytes);
    this.#bufferedBytes += bytes.length;
    return this.#decode(bytes);
  }

  #prepareDeletion(outSequence) {
    this.#assertActive();
    const index = secretCounter(outSequence, this.#originator ? 1 : 0);
    const cached = this.#history.get(index);
    if (!cached || index < this.#acknowledged) {
      throw new RangeError('No unacknowledged secret chat message at sequence');
    }
    const original = this.#decode(cached);
    if (original.message._ !== 'decryptedMessage') {
      throw new TypeError(
        'Only outgoing secret text/media messages can be deleted'
      );
    }
    const originalCodec = new SecretChatCodec({
      layer: original.layer,
      maxBytes: this.#codec.maxBytes,
    });
    const replacement = originalCodec.encode({
      ...original,
      message: secretDeletionMessage(original.message.random_id),
    });
    return { index, original, cached, replacement };
  }

  #installDeletion({ index, cached, replacement }) {
    this.#history.set(index, replacement);
    this.#bufferedBytes += replacement.length - cached.length;
    cached.fill(0);
  }

  /** Replace in place; persist atomically with a separate new deletion action. */
  replaceUnacknowledged(outSequence) {
    const prepared = this.#prepareDeletion(outSequence);
    try {
      this.#reserve(prepared.replacement.length - prepared.cached.length, 0);
    } catch (error) {
      prepared.replacement.fill(0);
      throw error;
    }
    this.#installDeletion(prepared);
    return this.#decode(prepared.replacement);
  }

  deleteUnacknowledged(outSequence, deletionId = randomId()) {
    const prepared = this.#prepareDeletion(outSequence);
    let deletion;
    try {
      if (BigInt(deletionId) === prepared.original.message.random_id) {
        throw new RangeError('Deletion service needs a distinct random ID');
      }
      deletion = this.#encodeNext(
        secretDeletionMessage(deletionId, prepared.original.message.random_id)
      );
      this.#reserve(
        prepared.replacement.length + deletion.length - prepared.cached.length
      );
    } catch (error) {
      prepared.replacement.fill(0);
      deletion?.fill(0);
      throw error;
    }
    this.#installDeletion(prepared);
    this.#history.set(this.#outgoing++, deletion);
    this.#bufferedBytes += deletion.length;
    return {
      replacement: this.#decode(prepared.replacement),
      deletion: this.#decode(deletion),
    };
  }

  #counter(wire, parity) {
    try {
      return secretCounter(wire, parity);
    } catch (cause) {
      this.#abort('Invalid secret chat sequence number or parity', cause);
    }
  }

  #resend(frame, output) {
    if (!isResend(frame)) {
      return false;
    }
    const action = frame.message.action;
    const parity = this.#originator ? 1 : 0;
    const first = this.#counter(action.start_seq_no, parity);
    const last = this.#counter(action.end_seq_no, parity);
    if (
      first > last ||
      last >= this.#outgoing ||
      last - first >= this.#maxHistory
    ) {
      this.#abort('Unsatisfiable secret chat resend range');
    }
    for (let index = first; index <= last; index++) {
      const cached = this.#history.get(index);
      if (!cached) {
        this.#abort('Requested secret chat message is no longer available');
      }
      output.retransmit.push(this.#decode(cached));
    }
    return true;
  }

  #consume(frame, handledResend, output) {
    const acknowledgement = this.#counter(
      frame.in_seq_no,
      this.#originator ? 1 : 0
    );
    if (
      acknowledgement < this.#acknowledged ||
      acknowledgement > this.#outgoing
    ) {
      this.#abort('Invalid secret chat acknowledgement');
    }
    this.#acknowledged = acknowledgement;
    this.#incoming++;
    if (!handledResend) {
      output.messages.push(frame);
    }
  }

  #drain(output) {
    while (this.#pending.has(this.#incoming)) {
      const { bytes, handledResend } = this.#pending.get(this.#incoming);
      this.#pending.delete(this.#incoming);
      this.#bufferedBytes -= bytes.length;
      const frame = this.#decode(bytes);
      bytes.fill(0);
      this.#consume(frame, handledResend, output);
    }
    if (this.#incoming > this.#requestedUntil) {
      this.#requestedUntil = undefined;
    }
    if (this.#pending.size && this.#requestedUntil === undefined) {
      this.#requestedUntil = Math.min(...this.#pending.keys()) - 1;
      output.resend = this.resendRequest();
    }
  }

  receive(frame) {
    this.#assertActive();
    const output = result();
    if (
      frame?.random_bytes instanceof Uint8Array &&
      frame.random_bytes.length < 15
    ) {
      output.ignored = true;
      return output;
    }
    try {
      this.#receive(frame, output);
      return output;
    } catch (cause) {
      if (cause === this.#failure) {
        throw cause;
      }
      this.#abort('Invalid secret chat layer message', cause);
    }
  }

  #receive(frame, output) {
    const index = this.#counter(frame.out_seq_no, this.#originator ? 0 : 1);
    const acknowledgement = this.#counter(
      frame.in_seq_no,
      this.#originator ? 1 : 0
    );
    if (index < this.#incoming || this.#pending.has(index)) {
      output.duplicate = true;
      return;
    }
    if (
      index >= MAX_COUNTER ||
      acknowledgement < this.#acknowledged ||
      acknowledgement > this.#outgoing
    ) {
      this.#abort('Invalid secret chat sequence acknowledgement or counter');
    }
    limit(frame.layer, 17, 216, 'received layer');
    if (!(frame.random_bytes instanceof Uint8Array)) {
      this.#abort('Invalid secret chat random padding');
    }
    const receivedCodec = new SecretChatCodec({
      layer: frame.layer,
      maxBytes: this.#codec.maxBytes,
    });
    const bytes = receivedCodec.encode(frame, 'DecryptedMessageLayer');
    const copy = this.#decode(bytes);
    const handledResend = this.#resend(copy, output);
    if (index === this.#incoming) {
      this.#consume(copy, handledResend, output);
    } else {
      if (
        this.#pending.size >= this.#maxPending ||
        this.#bufferedBytes + bytes.length > this.#maxBufferedBytes
      ) {
        this.#abort('Secret chat pending queue limit exceeded');
      }
      this.#pending.set(index, { bytes, handledResend });
      this.#bufferedBytes += bytes.length;
    }
    this.#drain(output);
  }

  resendRequest() {
    this.#assertActive();
    if (this.#requestedUntil === undefined) {
      return undefined;
    }
    const parity = this.#originator ? 0 : 1;
    return {
      _: 'decryptedMessageActionResend',
      start_seq_no: 2 * this.#incoming + parity,
      end_seq_no: 2 * this.#requestedUntil + parity,
    };
  }

  unacknowledged() {
    this.#assertActive();
    return [...this.#history]
      .filter(([index]) => index >= this.#acknowledged)
      .map(([, bytes]) => this.#decode(bytes));
  }

  /** Copied retained frames, including acknowledged retransmission history. */
  retained() {
    this.#assertActive();
    return [...this.#history.values()].map((bytes) => this.#decode(bytes));
  }

  /** Copied incoming frames waiting for a sequence gap to be filled. */
  pendingFrames() {
    this.#assertActive();
    return [...this.#pending.values()].map(({ bytes }) => this.#decode(bytes));
  }

  /** Release acknowledged history when an enclosing ciphertext budget is full. */
  pruneAcknowledged() {
    this.#assertActive();
    let removed = 0;
    for (const [index, bytes] of this.#history) {
      if (index >= this.#acknowledged) {
        break;
      }
      this.#history.delete(index);
      this.#bufferedBytes -= bytes.length;
      bytes.fill(0);
      removed++;
    }
    return removed;
  }

  exportState() {
    this.#assertActive();
    return {
      version: 1,
      originator: this.#originator,
      layer: this.#codec.layer,
      incoming: this.#incoming,
      outgoing: this.#outgoing,
      acknowledged: this.#acknowledged,
      history: [...this.#history.values()].map((bytes) =>
        Buffer.from(bytes).toString('base64')
      ),
      pending: [...this.#pending.values()].map(({ bytes }) =>
        Buffer.from(bytes).toString('base64')
      ),
      requestedUntil: this.#requestedUntil ?? null,
    };
  }

  destroy() {
    for (const bytes of this.#history.values()) {
      bytes.fill(0);
    }
    for (const { bytes } of this.#pending.values()) {
      bytes.fill(0);
    }
    this.#history.clear();
    this.#pending.clear();
    this.#bufferedBytes = 0;
    this.#failure ??= new TelegramError('Secret chat sequence was destroyed', {
      type: 'SECRET_CHAT_ABORTED',
    });
  }
}
