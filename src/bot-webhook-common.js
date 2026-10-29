import { joinBytes } from './bytes.js';

export const webhookHeader = 'x-telegram-bot-api-secret-token';
export const wrongWebhookToken = 'secret token is wrong';
export const jsonWebhookHeaders = { 'Content-Type': 'application/json' };
export const webhookMode = Symbol('anygram.webhook');

export function boundedWebhookUpdate(value, maxBytes) {
  if (
    new globalThis.TextEncoder().encode(JSON.stringify(value)).length > maxBytes
  ) {
    throw new RangeError('Webhook body exceeds byte limit');
  }
  return value;
}

export function sameWebhookSecret(actual, expected) {
  const encode = new globalThis.TextEncoder();
  const a = encode.encode(actual ?? '');
  const b = encode.encode(expected);
  let difference = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) {
    difference |= (a[i] ?? 0) ^ b[i];
  }
  return difference === 0;
}

export function webhookHandler(read, header, actions) {
  return {
    get update() {
      return read();
    },
    header,
    ...actions,
  };
}

export function webhookResult() {
  let finish;
  const handlerReturn = new Promise((resolve) => {
    finish = resolve;
  });
  return { finish, handlerReturn };
}

/** Request bodies stay lazy, so unauthorized requests never consume them. */
export function fetchWebhookInput(request, maxBytes) {
  let reader;
  return {
    async read() {
      if (!request.body?.getReader) {
        return boundedWebhookUpdate(await request.json(), maxBytes);
      }
      reader = request.body.getReader();
      const chunks = [];
      let length = 0;
      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            break;
          }
          length += value.byteLength;
          if (length > maxBytes) {
            throw new RangeError('Webhook body exceeds byte limit');
          }
          chunks.push(value);
        }
        return JSON.parse(
          new globalThis.TextDecoder().decode(joinBytes(chunks, length))
        );
      } catch (error) {
        // Cancellation is best effort; preserve the parse/limit failure.
        void reader.cancel(error).catch(() => {});
        throw error;
      } finally {
        reader.releaseLock();
        reader = undefined;
      }
    },
    close() {
      void reader?.cancel().catch(() => {});
    },
  };
}

/** Finite Node body collection; cancellation releases every owned listener. */
export function nodeWebhookInput(request, maxBytes) {
  let pending;
  let rejectRead;
  const chunks = [];
  let length = 0;
  const remove = () => {
    for (const [event, listener] of [
      ['data', data],
      ['end', end],
      ['error', error],
      ['aborted', aborted],
    ]) {
      request.removeListener?.(event, listener);
    }
  };
  const error = (reason) => {
    remove();
    chunks.length = 0;
    rejectRead?.(reason);
  };
  const aborted = () => error(new Error('Webhook request aborted'));
  let resolveRead;
  const end = () => {
    remove();
    try {
      resolveRead(
        JSON.parse(
          new globalThis.TextDecoder().decode(joinBytes(chunks, length))
        )
      );
    } catch (reason) {
      rejectRead(reason);
    }
  };
  const data = (chunk) => {
    const bytes =
      typeof chunk === 'string'
        ? new globalThis.TextEncoder().encode(chunk)
        : chunk;
    length += bytes.byteLength;
    if (length > maxBytes) {
      error(new RangeError('Webhook body exceeds byte limit'));
    } else {
      chunks.push(bytes);
    }
  };
  return {
    read() {
      pending ??= new Promise((resolve, reject) => {
        resolveRead = resolve;
        rejectRead = reject;
        request
          .on('data', data)
          .once('end', end)
          .once('aborted', aborted)
          .once('error', error);
      });
      return pending;
    },
    close() {
      error(new Error('Webhook body ownership ended'));
      chunks.length = 0;
    },
  };
}
