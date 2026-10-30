import { TelegramError } from './errors.js';
import { secretLimit as limit } from './secret-sequence-state.js';

const remoteLayer = (layer) => limit(layer, 46, 0x7fffffff, 'remote layer');
const sequence = (value) => limit(value, 0, 0x7fffffff, 'envelope sequence');

function restored(state, layer) {
  if (state?.version !== 1 || state.localLayer !== layer) {
    throw new TypeError(
      'Invalid secret chat layer state version or local layer'
    );
  }
  remoteLayer(state.remoteLayer);
  if (state.notifiedLayer !== 0) {
    limit(state.notifiedLayer, 46, layer, 'notified layer');
  }
  limit(state.highestLegacySequence, -1, 0x7fffffff, 'legacy sequence');
  if (state.minimumV2Sequence !== null) {
    limit(state.minimumV2Sequence, 0, 0x80000001, 'modern sequence boundary');
    if (state.highestLegacySequence >= state.minimumV2Sequence) {
      throw new RangeError(
        'Inconsistent secret chat envelope sequence history'
      );
    }
  }
  return {
    remoteLayer: state.remoteLayer,
    notifiedLayer: state.notifiedLayer,
    minimumV2Sequence: state.minimumV2Sequence,
    highestLegacySequence: state.highestLegacySequence,
  };
}

function observedRemote(frame, ordered) {
  let layer = frame.layer;
  if (
    ordered &&
    frame.message?._ === 'decryptedMessageService' &&
    frame.message.action?._ === 'decryptedMessageActionNotifyLayer'
  ) {
    layer = Math.max(layer, remoteLayer(frame.message.action.layer));
  }
  return layer;
}

/** Layer/version policy over authenticated frames accepted by sequence checks. */
export class SecretChatLayers {
  #local;
  #remote;
  #notified = 0;
  #minimumV2 = null;
  #highestLegacy = -1;

  constructor({ layer = 144, remoteLayer: remote = 46, state } = {}) {
    this.#local = limit(layer, 46, 216, 'local layer');
    this.#remote = remoteLayer(remote);
    if (state !== undefined) {
      const saved = restored(state, layer);
      this.#remote = saved.remoteLayer;
      this.#notified = saved.notifiedLayer;
      this.#minimumV2 = saved.minimumV2Sequence;
      this.#highestLegacy = saved.highestLegacySequence;
    } else if (Math.min(layer, remote) >= 73) {
      // Explicitly agreed starting layers need no legacy negotiation window.
      this.#minimumV2 = 0;
    }
  }

  get outgoing() {
    const layer = Math.min(this.#local, this.#remote);
    return { layer, version: layer >= 73 ? 2 : 1 };
  }

  get needsNotification() {
    return this.#notified < this.#local;
  }

  notification() {
    return { _: 'decryptedMessageActionNotifyLayer', layer: this.#local };
  }

  /** Call only after queuing the notification in the durable outgoing state. */
  markNotified(layer = this.#local) {
    this.#notified = limit(
      layer,
      Math.max(46, this.#notified),
      this.#local,
      'notified layer'
    );
  }

  upgradeLayer(layer) {
    this.#local = limit(layer, this.#local, 216, 'local layer upgrade');
  }

  /** Do not pass duplicates. For queued gaps, defer service actions until ordered. */
  observe(frame, version, { ordered = true } = {}) {
    if (version !== 1 && version !== 2) {
      throw new RangeError('Invalid secret chat envelope version');
    }
    const index = sequence(frame.out_seq_no);
    const layer = limit(frame.layer, 17, 0x7fffffff, 'received layer');
    if (layer > this.#local) {
      throw new TelegramError('Secret chat requires a newer supported layer', {
        type: 'SECRET_CHAT_LAYER_UNSUPPORTED',
      });
    }
    const remote = Math.max(this.#remote, observedRemote(frame, ordered));
    const boundary = version === 2 ? index : layer >= 73 ? index + 2 : null;
    const minimum =
      boundary === null
        ? this.#minimumV2
        : Math.min(this.#minimumV2 ?? boundary, boundary);
    const legacy =
      version === 1
        ? Math.max(this.#highestLegacy, index)
        : this.#highestLegacy;
    if (minimum !== null && legacy >= minimum) {
      throw new TelegramError('Secret chat envelope version downgrade', {
        type: 'SECRET_CHAT_DOWNGRADE',
      });
    }
    this.#remote = remote;
    this.#minimumV2 = minimum;
    this.#highestLegacy = legacy;
  }

  exportState() {
    return {
      version: 1,
      localLayer: this.#local,
      remoteLayer: this.#remote,
      notifiedLayer: this.#notified,
      minimumV2Sequence: this.#minimumV2,
      highestLegacySequence: this.#highestLegacy,
    };
  }
}
