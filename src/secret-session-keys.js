import { SecretChatKeyRing } from './secret-key-ring.js';
import { SecretChatRekey } from './secret-rekey.js';
import { secretDecodedBytes } from './secret-handshake-state.js';
import { secretCounter } from './secret-sequence-state.js';

const actions = new Set([
  'decryptedMessageActionRequestKey',
  'decryptedMessageActionAcceptKey',
  'decryptedMessageActionCommitKey',
  'decryptedMessageActionAbortKey',
]);

/** Session-owned key policy; all effects run on a disposable transactional draft. */
export class SecretSessionKeys {
  constructor({ key, originator, state, dh, now, maxBytes }) {
    this.originator = originator;
    try {
      if (state?.version === 2) {
        if (state.keyState?.originator !== originator) {
          throw new TypeError('Invalid secret chat key-ring role');
        }
        this.ring = new SecretChatKeyRing({
          state: { ...state.keyState, key: state.key },
          maxBytes,
        });
        if (state.rekey !== null) {
          this.rekey = new SecretChatRekey({ state: state.rekey, now });
        }
      } else {
        const bytes = state
          ? secretDecodedBytes(state.key, 256, 256, 'session key')
          : key;
        try {
          this.ring = new SecretChatKeyRing({
            key: bytes,
            originator,
            maxBytes,
          });
        } finally {
          if (state) {
            bytes.fill(0);
          }
        }
        if (dh) {
          this.rekey = new SecretChatRekey({ ...dh, now });
        }
      }
      this.validate();
    } catch (error) {
      this.destroy();
      throw error;
    }
  }

  validate() {
    const keys = this.ring.state;
    const rekey = this.rekey?.state;
    if (!rekey) {
      if (keys.previousFingerprint !== null) {
        throw new TypeError('Secret chat key transition lacks PFS state');
      }
    } else if (rekey.phase === 'committed') {
      if (
        keys.currentFingerprint !== rekey.fingerprint ||
        keys.previousFingerprint === null ||
        keys.confirmed
      ) {
        throw new TypeError('Inconsistent committed secret chat key');
      }
    } else if (
      ['requesting', 'accepted'].includes(rekey.phase) &&
      !keys.canRotate
    ) {
      throw new TypeError('Overlapping secret chat key transitions');
    } else if (
      rekey.phase === 'accepted' &&
      [keys.currentFingerprint, keys.previousFingerprint].includes(
        rekey.fingerprint
      )
    ) {
      throw new TypeError('Repeated accepted secret chat key');
    } else if (
      rekey.phase === 'idle' &&
      keys.previousFingerprint !== null &&
      !keys.confirmed
    ) {
      throw new TypeError('Unconfirmed secret chat key lacks pending commit');
    }
  }

  decrypt(data) {
    const candidate = this.rekey?.candidate;
    try {
      return this.ring.decrypt(data, { candidate: candidate?.key });
    } finally {
      candidate?.key.fill(0);
    }
  }

  /** Sequence acceptance must precede proof; duplicates must never reach here. */
  observe(frame, fingerprint, candidate, queue) {
    const index = secretCounter(frame.out_seq_no, this.originator ? 0 : 1);
    if (candidate) {
      if (this.rekey?.state.phase !== 'accepted') {
        throw new Error('Unexpected secret chat candidate proof');
      }
      this.apply(this.rekey.confirm(fingerprint), index, queue);
    } else if (
      fingerprint === this.ring.state.currentFingerprint &&
      this.rekey?.state.phase === 'committed'
    ) {
      this.rekey.confirm(fingerprint);
    }
    this.ring.observe(fingerprint, index);
    if (fingerprint === this.ring.state.currentFingerprint) {
      this.rekey?.record({ received: 1 });
    }
  }

  ordered(frame, queue) {
    const action =
      frame.message._ === 'decryptedMessageService'
        ? frame.message.action
        : undefined;
    if (!actions.has(action?._)) {
      return;
    }
    if (!this.rekey) {
      throw new Error('Secret chat re-keying requires original DH parameters');
    }
    if (
      action._ === 'decryptedMessageActionRequestKey' &&
      !this.ring.state.canRotate &&
      action.exchange_id !== this.rekey.state.exchangeId
    ) {
      queue({
        _: 'decryptedMessageActionAbortKey',
        exchange_id: action.exchange_id,
      });
      return;
    }
    const boundary =
      secretCounter(frame.out_seq_no, this.originator ? 0 : 1) + 1;
    this.apply(this.rekey.receive(action), boundary, queue);
  }

  apply(result, boundary, queue) {
    const install = () =>
      this.ring.install(
        result.install.key,
        result.installBeforeActions ? { boundary, confirmed: true } : undefined
      );
    try {
      if (result.install && result.installBeforeActions) {
        install();
      }
      for (const action of result.actions) {
        queue(action);
      }
      if (result.install && !result.installBeforeActions) {
        install();
      }
    } finally {
      result.install?.key.fill(0);
    }
  }

  rotate(exchangeId, queue) {
    if (!this.rekey) {
      throw new Error('Secret chat rotation requires original DH parameters');
    }
    if (!this.ring.state.canRotate) {
      throw new Error('Previous secret chat key still awaits ordered proof');
    }
    queue(this.rekey.request(exchangeId));
  }

  maybeRotate(queue) {
    if (this.ring.state.canRotate && this.rekey?.shouldRotate()) {
      this.rotate(undefined, queue);
    }
  }

  recordSent() {
    const pending = this.rekey?.state;
    // A commit still uses the previous key after the action machine resets usage.
    if (
      pending &&
      !(
        pending.phase === 'committed' &&
        pending.fingerprint !== this.ring.state.currentFingerprint
      )
    ) {
      this.rekey.record({ sent: 1 });
    }
  }

  exportState() {
    const { key, ...keyState } = this.ring.exportState();
    return { key, keyState, rekey: this.rekey?.exportState() ?? null };
  }

  destroy() {
    this.ring?.destroy();
    this.rekey?.destroy();
  }
}
