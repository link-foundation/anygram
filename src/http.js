import { TelegramError } from './errors.js';
import { joinBytes } from './bytes.js';

export function validateTimeout(timeout) {
  if (!Number.isFinite(timeout) || timeout <= 0 || timeout > 2147483647) {
    throw new RangeError('timeout must be positive and at most 2147483647 ms');
  }
}

export function createRequestScope({ signal, timeout }, timeoutReason) {
  validateTimeout(timeout);
  const controller = new globalThis.AbortController();
  const timer = globalThis.setTimeout(
    () => controller.abort(timeoutReason),
    timeout
  );
  return {
    controller,
    signal: signal
      ? globalThis.AbortSignal.any([signal, controller.signal])
      : controller.signal,
    dispose: () => globalThis.clearTimeout(timer),
  };
}

export function validateByteLimit(maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
    throw new RangeError('maxBytes must be a nonnegative safe integer');
  }
}

const tooLarge = () =>
  new TelegramError('HTTP response exceeds byte limit', {
    type: 'RESPONSE_TOO_LARGE',
  });

function checkContentLength(response, maxBytes) {
  const advertised = response.headers.get('content-length');
  if (advertised && /^\d+$/.test(advertised) && BigInt(advertised) > maxBytes) {
    response.body?.cancel().catch(() => {});
    throw tooLarge();
  }
}

/** Consume finite bytes and release the reader on every exit path. */
export async function readResponseBytes(response, { maxBytes, signal }) {
  validateByteLimit(maxBytes);
  if (signal?.aborted) {
    response.body?.cancel().catch(() => {});
    signal.throwIfAborted();
  }
  checkContentLength(response, maxBytes);
  if (!response.body) {
    return new Uint8Array();
  }
  const reader = response.body.getReader();
  const cancel = () => {
    reader.cancel().catch(() => {});
  };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    const chunks = [];
    let length = 0;
    for (;;) {
      signal?.throwIfAborted();
      const { value, done } = await reader.read();
      signal?.throwIfAborted();
      if (done) {
        break;
      }
      length += value.byteLength;
      if (length > maxBytes) {
        cancel();
        throw tooLarge();
      }
      chunks.push(value);
    }
    return joinBytes(chunks, length);
  } finally {
    signal?.removeEventListener('abort', cancel);
    reader.releaseLock();
  }
}
