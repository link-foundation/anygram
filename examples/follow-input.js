import { Parser } from 'links-notation';
import { open } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

const maximumBytes = 256 * 1024;
const parser = new Parser({ maxInputSize: maximumBytes });

function checkBytes(length) {
  if (length > maximumBytes) {
    throw new RangeError('Follow input exceeds 256 KiB');
  }
}

// The pinned parser's maxDepth option does not guard its generated grammar.
// Bound nesting before calling it, respecting quoted references and escapes.
function checkNesting(input) {
  let depth = 0;
  let quote;
  for (let index = 0; index < input.length; index++) {
    const character = input[index];
    if (quote) {
      if (
        character === '\\' ||
        (character === quote && input[index + 1] === quote)
      ) {
        index++;
      } else if (character === quote) {
        quote = undefined;
      }
    } else if (character === '"' || character === "'") {
      quote = character;
    } else if (character === '(') {
      if (++depth > 16) {
        throw new RangeError('Follow input nesting exceeds 16');
      }
    } else if (character === ')') {
      depth--;
    }
  }
}

function inputRows(input) {
  const tokens = input.trim() ? input.trim().split(/\s+/u) : [];
  if (
    !/[()'"]/.test(input) &&
    tokens.every(
      (token) => !token.includes(':') || /^(?:https?|tg):\/\//i.test(token)
    )
  ) {
    return tokens.map((id) => ({ id, values: [] }));
  }
  return parser.parse(input);
}

/** Parse follow's Links Notation or ordinary URL input, retaining every row. */
export function parseFollowLinks(input) {
  if (typeof input !== 'string') {
    throw new TypeError('Expected follow input text');
  }
  checkBytes(Buffer.byteLength(input));
  checkNesting(input);
  const values = [];
  for (const row of inputRows(input)) {
    for (const value of row.values.length
      ? row.values
      : row.id === null
        ? []
        : [row]) {
      if (value.values.length || typeof value.id !== 'string') {
        throw new TypeError('Follow links require a flat list of references');
      }
      if (value.id.length > 4096) {
        throw new RangeError('Follow links exceed 4096 characters');
      }
      values.push(value.id);
      if (values.length > 1000) {
        throw new RangeError('Follow input exceeds 1000 links');
      }
    }
  }
  return values;
}

async function readPipe(stdin, signal) {
  const chunks = [];
  let length = 0;
  const abort = () => stdin.destroy?.(signal.reason);
  signal?.addEventListener('abort', abort, { once: true });
  try {
    for await (const chunk of stdin) {
      signal?.throwIfAborted();
      const bytes = Buffer.from(chunk);
      length += bytes.length;
      checkBytes(length);
      chunks.push(bytes);
    }
    signal?.throwIfAborted();
    return Buffer.concat(chunks, length).toString('utf8');
  } finally {
    signal?.removeEventListener('abort', abort);
  }
}

export async function readFollowText(path, signal) {
  const file = await open(path, 'r');
  try {
    const bytes = Buffer.alloc(maximumBytes + 1);
    let length = 0;
    while (length < bytes.length) {
      signal?.throwIfAborted();
      const { bytesRead } = await file.read(
        bytes,
        length,
        bytes.length - length
      );
      if (!bytesRead) {
        break;
      }
      length += bytesRead;
    }
    checkBytes(length);
    signal?.throwIfAborted();
    return bytes.subarray(0, length).toString('utf8');
  } finally {
    await file.close();
  }
}

/** Explicit arguments, then nonempty stdin, then the existing follow cache. */
export async function loadFollowLinks({
  arguments: args = [],
  stdin,
  cachePath,
  signal,
} = {}) {
  signal?.throwIfAborted();
  if (!Array.isArray(args) || args.some((value) => typeof value !== 'string')) {
    throw new TypeError('Expected follow string arguments');
  }
  if (args.length) {
    return parseFollowLinks(args.join(' '));
  }
  const piped = stdin ? await readPipe(stdin, signal) : '';
  return parseFollowLinks(
    piped.trim()
      ? piped
      : await readFollowText(
          cachePath ?? join(homedir(), '.follow', 'telegram-links.lino'),
          signal
        )
  );
}
