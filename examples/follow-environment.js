import { parseEnv } from 'node:util';
import { Session } from '../src/index.js';
import { FileSessionStore } from '../src/storage.js';
import { readFollowText } from './follow-input.js';

const key = 'TELEGRAM_USER_SESSION';

async function read(path) {
  try {
    return await readFollowText(path);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return '';
    }
    throw error;
  }
}

// Skip complete quoted assignments so apparent keys inside values stay intact.
// parseEnv closes at the first matching quote, including after a backslash.
function assignments(text) {
  const spans = [];
  let cursor = 0;
  while (cursor < text.length) {
    let end = text.indexOf('\n', cursor);
    end = end < 0 ? text.length : end;
    const match = /^[ \t]*(?:export[ \t]+)?([A-Za-z_][\w]*)[ \t]*=[ \t]*/.exec(
      text.slice(cursor, end)
    );
    if (match) {
      const start = cursor + match[0].length;
      if (['"', "'", '`'].includes(text[start])) {
        const close = text.indexOf(text[start], start + 1);
        if (close >= 0) {
          const nextLine = text.indexOf('\n', close + 1);
          end = nextLine < 0 ? text.length : nextLine;
        }
      }
      if (match[1] === key) {
        spans.push([cursor, end - (text[end - 1] === '\r' ? 1 : 0)]);
      }
    }
    cursor = end + 1;
  }
  return spans;
}

function updated(text, session) {
  const previous = parseEnv(text);
  const spans = assignments(text);
  let result = '';
  let cursor = 0;
  for (const [index, [start, end]] of spans.entries()) {
    result += text.slice(cursor, start);
    result += index === 0 ? `${key}=${session}` : '';
    cursor = end;
  }
  result += text.slice(cursor);
  if (!spans.length) {
    const newline = text.includes('\r\n') ? '\r\n' : '\n';
    result += `${result && !result.endsWith('\n') ? newline : ''}${key}=${session}${newline}`;
  }
  if (Buffer.byteLength(result) > 256 * 1024) {
    throw new RangeError('Follow environment exceeds 256 KiB');
  }
  const next = parseEnv(result);
  delete previous[key];
  delete next[key];
  if (
    parseEnv(result)[key] !== session ||
    Object.keys(previous).length !== Object.keys(next).length ||
    Object.entries(previous).some(([name, value]) => next[name] !== value)
  ) {
    throw new Error('Cannot preserve unrelated follow environment settings');
  }
  return result;
}

/** Legacy follow persistence, sharing the atomic private-file writer. */
export class FollowEnvironmentSessionStore {
  constructor(path = '.env') {
    this.file = new FileSessionStore(path, { maxBytes: 256 * 1024 });
    this.queue = Promise.resolve();
  }

  async load() {
    return parseEnv(await read(this.file.path))[key] ?? '';
  }

  save(value) {
    const run = async () => {
      if (
        typeof value !== 'string' ||
        value.length > 8192 ||
        !/^[A-Za-z0-9:_+/=-]+$/.test(value) ||
        !new Session(value).options().authKey
      ) {
        throw new TypeError('Expected an authorized follow session');
      }
      await this.file.save(updated(await read(this.file.path), value));
    };
    const result = this.queue.then(run, run);
    this.queue = result.catch(() => {});
    return result;
  }
}
