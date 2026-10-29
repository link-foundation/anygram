import { hash } from './crypto.js';
import { secretDecodedBytes } from './secret-handshake-state.js';
import { secretDeletionMessage } from './secret-sequence-state.js';

/** Protected snapshots bind exact cached ciphertext to its retained plaintext. */
export function secretPacketDigest(body, data) {
  const bytes = Buffer.concat([body, data]);
  try {
    return hash('sha256', bytes).toString('base64');
  } finally {
    bytes.fill(0);
  }
}

export function secretDeletionFrame(frame) {
  return {
    ...frame,
    message: secretDeletionMessage(frame.message.random_id),
  };
}

function restorePacket(session, state, packet, frame, version, remaining) {
  const data = secretDecodedBytes(
    packet?.data,
    40,
    Math.min(remaining, session.codec.maxBytes + 1052),
    'outgoing packet'
  );
  let body, expected;
  try {
    body = session.keys.ring.decryptOutgoing(data, version);
    if (
      !body &&
      (state.version === 1 ||
        session.keys.ring.state.retiredFingerprint === null)
    ) {
      throw new Error('Secret chat outgoing packet has an unknown key');
    }
    expected = session.frameBytes(frame);
    const digest = secretPacketDigest(expected, data);
    if (
      (body && Buffer.compare(body, expected) !== 0) ||
      (state.version === 2 && packet.digest !== digest)
    ) {
      throw new Error('Secret chat outbox plaintext or digest mismatch');
    }
    return { data, digest };
  } catch (error) {
    data.fill(0);
    throw error;
  } finally {
    body?.fill(0);
    expected?.fill(0);
  }
}

function restoreReplacement(session, state, entry, frame, packet, remaining) {
  if (session.keys.rekey && frame.message._ === 'decryptedMessage') {
    packet.replacement = restorePacket(
      session,
      state,
      entry.replacement,
      secretDeletionFrame(frame),
      entry.version,
      remaining
    );
    if (
      Buffer.compare(
        packet.data.subarray(0, 8),
        packet.replacement.data.subarray(0, 8)
      ) !== 0
    ) {
      throw new Error('Secret chat deletion packet uses a different key');
    }
    return packet.replacement.data.length;
  }
  if (state.version === 2 && entry.replacement !== null) {
    throw new TypeError('Unexpected secret chat deletion packet');
  }
  return 0;
}

export function restoreSecretOutbox(session, state) {
  const history = session.history();
  if (!Array.isArray(state.outbox) || state.outbox.length !== history.length) {
    throw new RangeError('Invalid secret chat outbox coverage');
  }
  let remaining =
    session.limits.maxBufferedBytes - session.sequence.state.bufferedBytes;
  for (const [index, entry] of state.outbox.entries()) {
    const frame = history[index];
    if (
      entry.outSequence !== frame.out_seq_no ||
      entry.version !== (frame.layer >= 73 ? 2 : 1) ||
      typeof entry.submitted !== 'boolean'
    ) {
      throw new TypeError('Invalid secret chat outbox entry');
    }
    const packet = {
      ...restorePacket(session, state, entry, frame, entry.version, remaining),
      version: entry.version,
      submitted: entry.submitted,
      replacement: null,
    };
    session.outbox.set(entry.outSequence, packet);
    remaining -= packet.data.length;
    remaining -= restoreReplacement(
      session,
      state,
      entry,
      frame,
      packet,
      remaining
    );
  }
  session.checkBounds();
}
