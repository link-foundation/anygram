import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { Readable, pipeline } from 'node:stream';
import { createGunzip, createInflate, createBrotliDecompress } from 'node:zlib';

const redirects = new Set([301, 302, 303, 307, 308]);
const decoders = {
  gzip: createGunzip,
  deflate: createInflate,
  br: createBrotliDecompress,
};

function responseBody(message, request, method) {
  const headers = new globalThis.Headers();
  for (let index = 0; index < message.rawHeaders.length; index += 2) {
    headers.append(message.rawHeaders[index], message.rawHeaders[index + 1]);
  }
  let body = null;
  if (method === 'HEAD' || [204, 205, 304].includes(message.statusCode)) {
    message.resume();
  } else {
    const coding = headers.get('content-encoding');
    const decode = Object.hasOwn(decoders, coding)
      ? decoders[coding]
      : undefined;
    const stream = decode ? decode() : message;
    if (decode) {
      headers.delete('content-length');
      headers.delete('content-encoding');
      pipeline(message, stream, (error) => {
        if (error) {
          request.destroy(error);
        }
      });
    }
    body = Readable.toWeb(stream, {
      strategy: { highWaterMark: 65536, size: (chunk) => chunk.byteLength },
    });
  }
  return new globalThis.Response(body, {
    status: message.statusCode,
    statusText: message.statusMessage,
    headers,
  });
}

function requestOnce(url, init, agent) {
  const parsed = new globalThis.URL(url);
  const send = { 'http:': httpRequest, 'https:': httpsRequest }[
    parsed.protocol
  ];
  if (!send) {
    throw new TypeError('Agent transport requires HTTP or HTTPS');
  }
  const encoded = new globalThis.Request(parsed, { ...init, duplex: 'half' });
  return new Promise((resolve, reject) => {
    const request = send(parsed, {
      method: encoded.method,
      headers: Object.fromEntries(encoded.headers),
      signal: init.signal,
      agent: typeof agent === 'function' ? agent(parsed) : agent,
    });
    request.once('error', reject);
    request.once('response', (message) => {
      try {
        resolve(responseBody(message, request, encoded.method));
      } catch (error) {
        message.destroy();
        request.destroy();
        reject(error);
      }
    });
    request.once('upgrade', (_message, socket) => {
      socket.destroy();
      reject(new TypeError('Agent transport cannot upgrade HTTP connections'));
    });
    if (encoded.body) {
      const source = Readable.fromWeb(encoded.body);
      request.once('close', () => source.destroy());
      pipeline(source, request, (error) => {
        if (error) {
          request.destroy(error);
        }
      });
    } else {
      request.end();
    }
  });
}

function redirectOptions(response, current, target, init) {
  const headers = new globalThis.Headers(init.headers);
  const method = (init.method ?? 'GET').toUpperCase();
  const replace =
    (response.status === 303 && method !== 'HEAD') ||
    ([301, 302].includes(response.status) && method === 'POST');
  if (new globalThis.URL(current).origin !== target.origin) {
    for (const key of ['authorization', 'cookie', 'proxy-authorization']) {
      headers.delete(key);
    }
  }
  if (replace) {
    headers.delete('content-type');
    headers.delete('content-length');
  }
  return {
    ...init,
    headers,
    ...(replace && { method: 'GET', body: undefined }),
  };
}

/** Node agents control each connection; native readers own deadlines and limits. */
export function agentFetch(agent, fallback = globalThis.fetch) {
  if (agent === undefined) {
    return fallback;
  }
  return async (input, init = {}) => {
    let url = String(input);
    for (let count = 0; count <= 20; count++) {
      init.signal?.throwIfAborted();
      const response = await requestOnce(url, init, agent);
      if (
        !redirects.has(response.status) ||
        !response.headers.has('location')
      ) {
        return response;
      }
      await response.body?.cancel();
      if (count === 20) {
        throw new TypeError('Agent transport exceeds redirect limit');
      }
      const target = new globalThis.URL(response.headers.get('location'), url);
      init = redirectOptions(response, url, target, init);
      url = target.href;
    }
  };
}
