import { secretLimit } from './secret-sequence-state.js';
import { secretLong } from './secret-handshake-state.js';

// Leave room for the longest TL lifetime plus one playback second.
export const lifetimeTime = (value) =>
  secretLimit(value, 0, Number.MAX_SAFE_INTEGER - 0x80000000, 'lifetime time');

export function lifetimeDirection(value) {
  if (typeof value !== 'boolean') {
    throw new TypeError('Expected a secret message outgoing direction');
  }
  return value;
}

export function lifetimeEntry(value) {
  if (!value || !['read', 'open'].includes(value.startOn)) {
    throw new TypeError('Expected a secret lifetime read/open trigger');
  }
  return {
    randomId: secretLong(value.randomId, 'lifetime random ID'),
    outgoing: lifetimeDirection(value.outgoing),
    date: lifetimeTime(value.date),
    ttl: secretLimit(value.ttl, 1, 0x80000000, 'effective message TTL'),
    startOn: value.startOn,
    readAt: value.readAt === null ? null : lifetimeTime(value.readAt),
  };
}

export const lifetimeKey = (entry) =>
  `${entry.outgoing ? 'out' : 'in'}:${entry.randomId}`;

export const lifetimeCopy = (entry) => ({
  ...entry,
  expiresAt: entry.readAt === null ? null : entry.readAt + entry.ttl,
});

export function lifetimeIds(ids) {
  if (!Array.isArray(ids) || ids.length > 1000) {
    throw new RangeError('Secret lifetime ID limit exceeded');
  }
  return new Set(ids.map((id) => secretLong(id, 'lifetime random ID')));
}

/** Match the official peer's minimum audio/video playback lifetime. */
export function lifetimeTTL(message) {
  const ttl = secretLimit(message.ttl, 0, 0x7fffffff, 'message TTL');
  if (!ttl) {
    return 0;
  }
  const media = message.media;
  const attribute = media?.attributes?.find((item) =>
    ['documentAttributeAudio', 'documentAttributeVideo'].includes(item._)
  );
  const duration = attribute?.duration ?? media?.duration ?? 0;
  if (
    typeof duration !== 'number' ||
    !Number.isFinite(duration) ||
    duration < 0 ||
    duration > 0x7fffffff
  ) {
    throw new RangeError('Invalid secret media duration');
  }
  return Math.max(ttl, Math.floor(duration + 1));
}
