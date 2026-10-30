export const secretHeader = 'x-telegram-bot-api-secret-token';

export async function postUpdate(server, { id = 1, mode, body, headers } = {}) {
  const response = await fetch(`${server.root}/hook`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [secretHeader]: mode === 'unauthorized' ? 'wrong' : 'secret',
      ...headers,
    },
    body:
      body ??
      (mode === 'malformed'
        ? '{"update_id":'
        : JSON.stringify({
            update_id: id,
            ...(mode === 'oversized' && { padding: 'x'.repeat(32768) }),
          })),
    signal: globalThis.AbortSignal.timeout(3000),
  });
  return {
    status: response.status,
    contentType: response.headers.get('content-type'),
    body: await response.text(),
  };
}

export function unwrapCallback(callback) {
  return (...args) =>
    Promise.resolve(callback(...args)).catch((error) => {
      throw error.error ?? error;
    });
}

export function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

export async function settled(task) {
  let timer;
  try {
    return await Promise.race([
      task,
      new Promise((resolve, reject) => {
        timer = globalThis.setTimeout(
          () => reject(new Error('Framework task did not settle')),
          3000
        );
      }),
    ]);
  } finally {
    globalThis.clearTimeout(timer);
  }
}
