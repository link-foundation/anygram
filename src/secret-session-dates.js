import { secretLimit } from './secret-sequence-state.js';
import { secretPacketDigest } from './secret-session-outbox.js';

export const secretMessageDate = (value) =>
  secretLimit(value, 0, 0x7fffffff, 'message date');

export const secretPendingFrames = (session) =>
  new Map(
    (session.sequence?.pendingFrames() ?? []).map((frame) => [
      frame.out_seq_no,
      frame,
    ])
  );

function dateDigest(session, frame, date) {
  const body = session.frameBytes(frame);
  const bytes = Buffer.alloc(4);
  bytes.writeInt32LE(date);
  try {
    return secretPacketDigest(body, bytes);
  } finally {
    body.fill(0);
    bytes.fill(0);
  }
}

export function restoreSecretDates(session, state) {
  const pending = secretPendingFrames(session);
  const entries = state.incomingDates === undefined ? [] : state.incomingDates;
  if (!Array.isArray(entries) || entries.length > pending.size) {
    throw new RangeError('Invalid secret chat pending date coverage');
  }
  for (const entry of entries) {
    if (
      !Array.isArray(entry) ||
      entry.length !== 3 ||
      !pending.has(entry[0]) ||
      session.incomingDates.has(entry[0])
    ) {
      throw new TypeError('Invalid secret chat pending date tuple');
    }
    const [wire, value, digest] = entry;
    const date = secretMessageDate(value);
    if (digest !== dateDigest(session, pending.get(wire), date)) {
      throw new TypeError('Secret chat pending date digest mismatch');
    }
    session.incomingDates.set(wire, date);
  }
}

export function exportSecretDates(session) {
  if (!session.incomingDates.size) {
    return [];
  }
  const pending = secretPendingFrames(session);
  return [...session.incomingDates].map(([wire, date]) => [
    wire,
    date,
    dateDigest(session, pending.get(wire), date),
  ]);
}
