/** Stop waiting for an operation without dropping its eventual rejection. */
export function abortable(promise, signal) {
  return new Promise((resolve, reject) => {
    const settle = (callback, value) => {
      signal?.removeEventListener('abort', abort);
      callback(value);
    };
    const abort = () => settle(reject, signal.reason);
    signal?.addEventListener('abort', abort, { once: true });
    Promise.resolve(promise).then(
      (value) => settle(resolve, value),
      (error) => settle(reject, error)
    );
    if (signal?.aborted) {
      abort();
    }
  });
}
