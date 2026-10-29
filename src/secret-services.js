import { secretLimit } from './secret-sequence-state.js';
import { secretLong } from './secret-handshake-state.js';

export const MAX_SECRET_TTL = 365 * 24 * 60 * 60;
const prefix = 'decryptedMessageAction';
const applications = new Set([
  'SetMessageTTL',
  'ReadMessages',
  'DeleteMessages',
  'ScreenshotMessages',
  'FlushHistory',
  'Typing',
]);

export function secretMessageTTL(seconds, maximum = MAX_SECRET_TTL) {
  return secretLimit(seconds, 0, maximum, 'message TTL');
}

export function secretOutgoingMessage(message, ttl) {
  if (message?._ === 'decryptedMessage') {
    return {
      ...message,
      ttl: secretMessageTTL(
        message.ttl === undefined ? ttl : message.ttl,
        0x7fffffff
      ),
    };
  }
  if (message?.action?._ === `${prefix}SetMessageTTL`) {
    secretMessageTTL(message.action.ttl_seconds);
  }
  return message;
}

/** Bounds public application services; key/layer/resend services have owners. */
export function secretApplicationService(action) {
  if (
    !action ||
    !applications.has(action._?.slice(prefix.length)) ||
    !action._.startsWith(prefix)
  ) {
    throw new TypeError('Expected a secret chat application service action');
  }
  if (action._ === `${prefix}SetMessageTTL`) {
    secretMessageTTL(action.ttl_seconds);
  }
  if (
    ['ReadMessages', 'DeleteMessages', 'ScreenshotMessages'].some(
      (name) => action._ === `${prefix}${name}`
    )
  ) {
    if (!Array.isArray(action.random_ids) || action.random_ids.length > 1000) {
      throw new RangeError('Secret chat service ID limit exceeded');
    }
    return {
      ...action,
      random_ids: [
        ...new Set(
          action.random_ids.map((id) => secretLong(id, 'service message ID'))
        ),
      ],
    };
  }
  return action;
}

/** Official peers clamp invalid received TTL settings to one year. */
export function secretObservedTTL(message, previous) {
  if (
    message._ !== 'decryptedMessageService' ||
    message.action._ !== `${prefix}SetMessageTTL`
  ) {
    return previous;
  }
  const ttl = message.action.ttl_seconds;
  return ttl < 0 || ttl > MAX_SECRET_TTL ? MAX_SECRET_TTL : ttl;
}
