import { createHash } from 'node:crypto';
import { TelegramError } from './errors.js';

const active = new Set();

export function pollingKey(token, options) {
  if (typeof token !== 'string') {
    return options.api ?? {};
  }
  const base = (options.baseUrl ?? 'https://api.telegram.org').replace(
    /\/$/,
    ''
  );
  const endpoint = `${base}/${options.apiMode ?? 'bot'}${token}${options.testEnv ? '/test' : ''}/getUpdates`;
  return createHash('sha256')
    .update(`${normalizedEndpoint(endpoint)}\0${token}`)
    .digest('hex');
}

function normalizedEndpoint(endpoint) {
  try {
    return new globalThis.URL(endpoint).href;
  } catch {
    // Custom transports may use a relative base understood by their fetch hook.
    return endpoint;
  }
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
