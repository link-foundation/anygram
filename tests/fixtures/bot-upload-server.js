import { createServer } from 'node:http';

/** Finite, account-free wire oracle for actual vendor multipart encoders. */
export async function uploadServer({
  trace = () => {},
  result = () => true,
  maxRequests = 8,
} = {}) {
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 32) {
    throw new RangeError('Invalid fixture request limit');
  }
  const requests = [];
  const server = createServer((request, response) => {
    trace({
      event: 'headers',
      method: request.method,
      headers: request.headers,
    });
    const chunks = [];
    let length = 0;
    request.on('data', (chunk) => {
      trace({ event: 'chunk', length: chunk.length });
      length += chunk.length;
      if (length > 64 * 1024 || requests.length >= maxRequests) {
        request.destroy(new Error('Fixture upload limit exceeded'));
      } else {
        chunks.push(chunk);
      }
    });
    request.on('error', (error) => {
      trace({ event: 'error', message: error.message });
      response.destroy();
    });
    request.on('end', () => {
      trace({ event: 'end', length });
      const received = {
        url: request.url,
        headers: request.headers,
        body: Buffer.concat(chunks),
      };
      requests.push(received);
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ ok: true, result: result(received) }));
    });
  });
  server.requestTimeout = 5000;
  server.setTimeout(3000, (socket) => socket.destroy());
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  return {
    root: `http://127.0.0.1:${server.address().port}`,
    requests,
    close: () => {
      server.closeAllConnections();
      return new Promise((resolve) => server.close(resolve));
    },
  };
}

/** Independent parser for the finite binary fixtures, including older Node. */
export function multipartFields(request) {
  const type = request.headers['content-type'];
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/.exec(type);
  if (!boundary || request.body.length > 64 * 1024) {
    throw new Error('Invalid bounded multipart fixture');
  }
  const fields = new Map();
  const parts = request.body
    .toString('latin1')
    .split(`--${boundary[1] ?? boundary[2]}`);
  if (parts.length > 16) {
    throw new Error('Too many fixture parts');
  }
  for (const part of parts.slice(1, -1)) {
    const separator = part.indexOf('\r\n\r\n');
    const headers = part.slice(0, separator);
    if (process.env.ANYGRAM_TRACE_UPLOAD) {
      console.error({ partHeaders: headers });
    }
    const name = /(?:^|;)\s*name="([^"]+)"/m.exec(headers)?.[1];
    const filenameField = /(?:^|;)\s*filename=(?:"([^"]*)"|([^;\r\n]*))/m.exec(
      headers
    );
    const filename = filenameField?.[1] ?? filenameField?.[2];
    if (separator < 0 || !name || !part.endsWith('\r\n')) {
      throw new Error('Malformed fixture part');
    }
    const bytes = Buffer.from(part.slice(separator + 4, -2), 'latin1');
    fields.set(
      name,
      filename === undefined
        ? bytes.toString()
        : {
            name: filename,
            bytes: new Uint8Array(bytes),
          }
    );
  }
  return fields;
}
