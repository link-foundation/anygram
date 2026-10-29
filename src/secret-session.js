import {
  SecretSessionState,
  secretSessionLimits,
} from './secret-session-state.js';
import { throwFailures } from './errors.js';
import { secretLimit } from './secret-sequence-state.js';

/** Active chat state with transactional key transitions and a durable outbox. */
export class SecretChatSession {
  #data;
  #limits;
  #busy = false;
  #destroyed = false;
  #lastReceipt;
  #lastClient;
  #now;

  constructor(options = {}) {
    if (options.now !== undefined && typeof options.now !== 'function') {
      throw new TypeError('Secret chat session clock must be a function');
    }
    this.#limits = secretSessionLimits(options);
    this.#now = options.now;
    this.#data = new SecretSessionState(options, this.#limits);
  }

  get visualization() {
    this.#assertAlive();
    this.#data.assertActive();
    return this.#data.keys.ring.visualization;
  }

  get state() {
    this.#assertAlive();
    return {
      phase: this.#data.phase,
      pending: this.#data.pending().length,
      sequence:
        this.#data.phase === 'active' ? this.#data.sequence.state : null,
      layers:
        this.#data.phase === 'active' ? this.#data.layers.exportState() : null,
      discardSubmitted: this.#data.discardSubmitted,
      keys: this.#data.phase === 'active' ? this.#data.keys.ring.state : null,
      rekey:
        this.#data.phase === 'active'
          ? (this.#data.keys.rekey?.state ?? null)
          : null,
    };
  }

  #assertAlive() {
    if (this.#destroyed) {
      throw new Error('Secret chat session has been destroyed');
    }
  }

  async #exclusive({ save, signal } = {}, task) {
    this.#assertAlive();
    if (typeof save !== 'function') {
      throw new TypeError(
        'Secret chat session requires a durable save callback'
      );
    }
    if (this.#busy) {
      throw new Error('Secret chat session operation already in progress');
    }
    signal?.throwIfAborted();
    this.#busy = true;
    try {
      return await task(save);
    } finally {
      this.#busy = false;
    }
  }

  #copy() {
    return new SecretSessionState(
      { state: this.#data.exportState(), now: this.#now },
      this.#limits
    );
  }

  async #commit(draft, save, effects = { messages: [], aborted: false }) {
    await save(draft.exportState(), globalThis.structuredClone(effects));
    this.#data.destroy();
    this.#data = draft;
  }

  async #transaction(save, signal, action) {
    const draft = this.#copy();
    try {
      const output = action(draft);
      signal?.throwIfAborted();
      await this.#commit(draft, save, {
        messages: output?.messages ?? [],
        aborted: false,
        ...(output?.files ? { files: output.files } : {}),
      });
      return output;
    } finally {
      if (draft !== this.#data) {
        draft.destroy();
      }
    }
  }

  queue(message, options) {
    return this.#queue(message, undefined, options);
  }

  queueFile(message, file, options) {
    return this.#queue(message, file, options);
  }

  #queue(message, file, options) {
    return this.#exclusive(options, (save) =>
      this.#transaction(save, options?.signal, (draft) => {
        draft.assertActive();
        const bytes = draft.codec.encode(message, 'DecryptedMessage');
        let copy;
        try {
          copy = draft.codec.decode(bytes, 'DecryptedMessage');
        } finally {
          bytes.fill(0);
        }
        draft.notify();
        const frame = draft.queue(copy, file);
        draft.rotateIfNeeded();
        return frame;
      })
    );
  }

  notify(options) {
    return this.#exclusive(options, (save) =>
      this.#transaction(save, options?.signal, (draft) => {
        const frame = draft.notify();
        draft.rotateIfNeeded();
        return frame;
      })
    );
  }

  rotateKey(exchangeId, options) {
    return this.#exclusive(options, (save) =>
      this.#transaction(save, options?.signal, (draft) =>
        draft.rotateKey(exchangeId)
      )
    );
  }

  upgradeLayer(layer, options) {
    return this.#exclusive(options, (save) =>
      this.#transaction(save, options?.signal, (draft) => {
        draft.assertActive();
        draft.layers.upgradeLayer(layer);
        draft.sequence.upgradeLayer(draft.layers.outgoing.layer);
        const frame = draft.notify();
        draft.rotateIfNeeded();
        return frame;
      })
    );
  }

  deleteUnacknowledged(outSequence, deletionId, options) {
    return this.#exclusive(options, (save) =>
      this.#transaction(save, options?.signal, (draft) => {
        draft.assertActive();
        const version = draft.outbox.get(outSequence)?.version;
        const output = draft.sequence.deleteUnacknowledged(
          outSequence,
          deletionId
        );
        draft.replaceDeleted(output.replacement, version);
        draft.encrypt(output.deletion, draft.layers.outgoing.version);
        draft.keys.recordSent();
        draft.rotateIfNeeded();
        return output;
      })
    );
  }

  receive(data, options) {
    return this.#exclusive(options, async (save) => {
      if (
        !(data instanceof Uint8Array) ||
        data.length >
          Math.min(this.#limits.maxBufferedBytes, 16 * 1024 * 1024) + 1052
      ) {
        throw new RangeError('Invalid secret chat incoming packet length');
      }
      const owned = Uint8Array.from(data);
      let protocolFailure;
      try {
        return await this.#transaction(save, options?.signal, (draft) => {
          try {
            return draft.receive(owned, options?.file);
          } catch (error) {
            if (error.type === 'SECRET_CHAT_ABORTED') {
              protocolFailure = error;
            }
            throw error;
          }
        });
      } catch (error) {
        if (protocolFailure && error === protocolFailure) {
          const effects = this.#data.abort();
          const failures = [error];
          try {
            await save(this.#data.exportState(), effects);
          } catch (storageError) {
            failures.push(storageError);
          }
          throwFailures(failures, 'Secret chat abort and persistence failed');
        }
        throw error;
      } finally {
        owned.fill(0);
      }
    });
  }

  flush(client, options) {
    return this.#exclusive(options, async (save) => {
      if (typeof client?.callWithReceipt !== 'function') {
        throw new TypeError(
          'Secret chat submission requires native RPC receipts'
        );
      }
      if (this.#lastClient !== client) {
        this.#lastReceipt = undefined;
        this.#lastClient = client;
      }
      if (this.#data.phase !== 'active') {
        return this.#flushDiscard(client, options, save);
      }
      const receipts = [];
      for (const { outSequence, request } of this.#data.pending()) {
        options?.signal?.throwIfAborted();
        const { _, ...params } = request;
        const receipt = await client.callWithReceipt(_, params, {
          signal: options?.signal,
          timeout: options?.timeout,
          dc: this.#lastReceipt?.dc,
          afterMessageIds: this.#lastReceipt
            ? [this.#lastReceipt.messageId]
            : [],
        });
        validateReceipt(receipt, _);
        const effects = this.#data.receiptEffects(outSequence, receipt.value);
        this.#lastReceipt = {
          messageId: receipt.messageId,
          dc: receipt.dc,
        };
        await this.#transaction(save, undefined, (draft) => {
          draft.outbox.get(outSequence).submitted = true;
          return effects;
        });
        receipts.push(receipt);
      }
      return receipts;
    });
  }

  async #flushDiscard(client, options, save) {
    if (this.#data.discardSubmitted) {
      return [];
    }
    await save(this.#data.exportState(), { messages: [], aborted: true });
    options?.signal?.throwIfAborted();
    const receipt = await client.callWithReceipt(
      'messages.discardEncryption',
      { chat_id: this.#data.peer.chat_id },
      {
        signal: options?.signal,
        timeout: options?.timeout,
      }
    );
    if (receipt.value !== true) {
      throw new TypeError('Invalid secret chat discard response');
    }
    await this.#transaction(save, undefined, (draft) => {
      draft.discardSubmitted = true;
    });
    return [receipt];
  }

  pending() {
    this.#assertAlive();
    return this.#data.pending();
  }

  exportState() {
    this.#assertAlive();
    return this.#data.exportState();
  }

  destroy() {
    if (this.#busy) {
      throw new Error('Secret chat session operation already in progress');
    }
    this.#data.destroy();
    this.#destroyed = true;
  }
}

function validateReceipt(receipt, method) {
  if (
    typeof receipt?.messageId !== 'bigint' ||
    receipt.messageId <= 0n ||
    receipt.messageId >= 1n << 63n ||
    receipt.messageId % 4n
  ) {
    throw new TypeError('Invalid secret chat RPC message receipt');
  }
  secretLimit(receipt.dc, 1, 5, 'receipt data center');
  const expected =
    method === 'messages.sendEncryptedFile'
      ? 'messages.sentEncryptedFile'
      : 'messages.sentEncryptedMessage';
  if (receipt.value?._ !== expected) {
    throw new TypeError('Invalid secret chat send response');
  }
  secretLimit(receipt.value.date, 0, 0x7fffffff, 'message date');
}
