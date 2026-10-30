import { mkdir, open, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

const maximumBytes = 16 * 1024 * 1024;

function checkLimit(limit) {
  if (!Number.isInteger(limit) || limit < 1 || limit > maximumBytes) {
    throw new RangeError('File byte limit must be between 1 and 16 MiB');
  }
}

function checkSize(length, limit) {
  if (length > limit) {
    const unit = limit % 1024 ? `${limit} bytes` : `${limit / 1024} KiB`;
    throw new RangeError(`File exceeds ${unit}`);
  }
}

/** Read at most the byte limit plus one, then decode complete UTF-8 bytes. */
export async function readTextFile(
  path,
  { maxBytes = maximumBytes, signal } = {}
) {
  checkLimit(maxBytes);
  signal?.throwIfAborted();
  const file = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(maxBytes + 1, 65536));
    const chunks = [];
    let length = 0;
    while (true) {
      signal?.throwIfAborted();
      const { bytesRead } = await file.read(
        buffer,
        0,
        Math.min(buffer.length, maxBytes - length + 1)
      );
      signal?.throwIfAborted();
      if (!bytesRead) {
        return Buffer.concat(chunks, length).toString('utf8');
      }
      length += bytesRead;
      checkSize(length, maxBytes);
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
  } finally {
    await file.close();
  }
}

/** Atomic local persistence. Session strings confer account access. */
export class FileSessionStore {
  constructor(path, { maxBytes = maximumBytes } = {}) {
    checkLimit(maxBytes);
    this.path = resolve(path);
    this.maxBytes = maxBytes;
    this.queue = Promise.resolve();
  }
  async load({ signal } = {}) {
    try {
      return await readTextFile(this.path, { maxBytes: this.maxBytes, signal });
    } catch (error) {
      signal?.throwIfAborted();
      if (error.code === 'ENOENT') {
        return '';
      }
      throw error;
    }
  }
  save(session) {
    const run = async () => {
      if (typeof session !== 'string') {
        throw new TypeError('Expected a session string');
      }
      checkSize(Buffer.byteLength(session), this.maxBytes);
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
      const temporary = `${this.path}.${randomBytes(8).toString('hex')}.tmp`;
      try {
        await writeFile(temporary, session, {
          encoding: 'utf8',
          mode: 0o600,
          flag: 'wx',
        });
        await rename(temporary, this.path);
      } finally {
        await rm(temporary, { force: true });
      }
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }
}
