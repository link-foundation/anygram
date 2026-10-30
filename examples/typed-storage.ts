import { FileSessionStore, readTextFile } from '../src/storage.js';
import type { SessionStore } from '../src/storage.js';

export async function restoreSession(path: string, signal?: AbortSignal) {
  const store: SessionStore = new FileSessionStore(path, { maxBytes: 8192 });
  return await store.load({ signal });
}

export async function readSettings(path: URL, signal?: AbortSignal) {
  return await readTextFile(path, { maxBytes: 256 * 1024, signal });
}
