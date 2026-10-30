import { AsyncLocalStorage } from 'node:async_hooks';

/** Context is borrowable only while its owning asynchronous task is active. */
export function taskContext() {
  const storage = new AsyncLocalStorage();
  return {
    current() {
      const frame = storage.getStore();
      return frame?.active ? frame : undefined;
    },
    run(value, task) {
      const frame = { value, active: true };
      return storage.run(frame, async () => {
        try {
          return await task();
        } finally {
          frame.active = false;
        }
      });
    },
  };
}
