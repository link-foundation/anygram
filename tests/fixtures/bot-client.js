import assert from 'node:assert/strict';
import { gunzipSync } from 'node:zlib';
import { createClient } from '../../src/index.js';

/** Actual automatic constructors pointed at the independent finite HTTP peer. */
export function selectedBotClient(backend, root, token) {
  const clientOptions = {
    grammy: { client: { apiRoot: root } },
    telegraf: { telegram: { apiRoot: root } },
    'node-telegram-bot-api': { apiRoot: root, maxRetries: 0 },
  }[backend];
  return createClient({
    token,
    backend,
    native: backend === 'native',
    libraries: backend === 'native' ? [] : [backend],
    baseUrl: root,
    clientOptions,
    timeout: 2000,
  });
}

/** Decode the small JSON/form fixtures independently of production encoders. */
export function botRequestFields({ headers, body }) {
  if (headers['content-encoding'] === 'gzip') {
    body = gunzipSync(body, { maxOutputLength: 64 * 1024 });
  }
  if (headers['content-type'].includes('application/json')) {
    return JSON.parse(body.toString());
  }
  assert.match(headers['content-type'], /application\/x-www-form-urlencoded/);
  return Object.fromEntries(
    [...new globalThis.URLSearchParams(body.toString())].map(([key, value]) => {
      try {
        return [key, JSON.parse(value)];
      } catch {
        return [key, value];
      }
    })
  );
}
