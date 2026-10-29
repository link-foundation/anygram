import { valueMapper } from './requests.js';
import { InputFile, readInputFile } from './input-file.js';
import { validateByteLimit } from './http.js';

function attachment(value) {
  if (value instanceof InputFile) {
    return value;
  }
  const source = value?.data ?? value?.source ?? value;
  if (
    source instanceof Uint8Array ||
    source instanceof globalThis.Blob ||
    (value?.source !== undefined &&
      Object.keys(value).every((key) =>
        ['source', 'filename', 'mimeType'].includes(key)
      ))
  ) {
    return new InputFile(source, value.filename);
  }
}

export const stringify = (value) =>
  JSON.stringify(value, (key, entry) =>
    typeof entry === 'bigint' ? entry.toString() : entry
  );

/** Validate the entire shape before opening any of its finite upload sources. */
export async function uploadBody(params, { maxBytes, signal, fetch }) {
  validateByteLimit(maxBytes);
  const files = [];
  const visit = valueMapper(
    (value, next) => {
      const input = attachment(value);
      if (input) {
        if (files.length >= 1000) {
          throw new RangeError('Bot API upload exceeds file limit');
        }
        const name = `file${files.length}`;
        files.push({ name, input, mimeType: value.mimeType });
        return `attach://${name}`;
      }
      return value && typeof value === 'object'
        ? Object.fromEntries(
            Object.entries(value).map(([key, entry]) => [key, next(entry)])
          )
        : value;
    },
    { label: 'Bot API' }
  );
  const fields = visit(params);
  if (!files.length) {
    return {
      body: stringify(fields),
      headers: { 'content-type': 'application/json' },
    };
  }
  const body = new globalThis.FormData();
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined && value !== null) {
      body.append(
        key,
        typeof value === 'object' ? stringify(value) : String(value)
      );
    }
  }
  let used = 0;
  for (const { name, input, mimeType } of files) {
    const bytes = await readInputFile(input, {
      maxBytes: maxBytes - used,
      signal,
      fetch,
    });
    used += bytes.byteLength;
    body.append(
      name,
      new globalThis.Blob([bytes], {
        type: mimeType ?? input.fileData?.type ?? 'application/octet-stream',
      }),
      input.filename ?? 'file'
    );
  }
  signal?.throwIfAborted();
  return { body };
}
