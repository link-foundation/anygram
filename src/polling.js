import { createHash } from 'node:crypto';
import { TelegramError } from './errors.js';

const active = new Set();

export function pollingKey(token, options) {
  return typeof token === 'string'
    ? createHash('sha256')
        .update(`${options.baseUrl ?? 'https://api.telegram.org'}\0${token}`)
        .digest('hex')
    : (options.api ?? {});
}

export function acquirePolling(key) {
  if (active.has(key)) {
    throw new TelegramError(
      'Another bot instance is polling this token; stop it before starting a replacement',
      {
        type: 'POLLING_CONFLICT',
      }
    );
  }
  active.add(key);
  return () => active.delete(key);
}

export function validatePollCount(maxPolls) {
  if (
    !(
      maxPolls === Infinity ||
      (Number.isSafeInteger(maxPolls) && maxPolls >= 0)
    )
  ) {
    throw new RangeError('Invalid polling limit');
  }
}

export function validatePolling(maxPolls, timeout) {
  validatePollCount(maxPolls);
  if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 2147473) {
    throw new RangeError('Invalid polling controls');
  }
}
