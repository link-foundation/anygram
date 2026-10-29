/** Hold a callback-owned connection until explicit release or cancellation. */
export function holdFollowConnection(run, signal) {
  let ready;
  let failed;
  let release;
  let released = false;
  const opened = new Promise((resolve, reject) => {
    ready = resolve;
    failed = reject;
  });
  const closed = run(async (client) => {
    if (released) {
      return;
    }
    signal?.throwIfAborted();
    await new Promise((resolve, reject) => {
      const abort = () => reject(signal.reason);
      signal?.addEventListener('abort', abort, { once: true });
      release = () => {
        signal?.removeEventListener('abort', abort);
        resolve();
      };
      ready(client);
    }).finally(() => release());
  });
  // Handle background failure immediately, preserving it for disconnect().
  closed.then(
    () => failed(new Error('Follow connection closed before becoming ready')),
    failed
  );
  return {
    ready: opened,
    closed,
    release() {
      released = true;
      release?.();
    },
  };
}
