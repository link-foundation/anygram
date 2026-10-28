import { mkdir, readFile, writeFile, rename, rm } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';

/** Atomic local persistence. Session strings confer account access. */
export class FileSessionStore {
  constructor(path) {
    this.path = resolve(path);
    this.queue = Promise.resolve();
  }
  async load() {
    try {
      return await readFile(this.path, 'utf8');
    } catch (error) {
      if (error.code === 'ENOENT') {
        return '';
      }
      throw error;
    }
  }
  save(session) {
    const run = async () => {
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
