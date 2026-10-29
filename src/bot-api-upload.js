import { valueMapper, mapObjectValues } from './requests.js';
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
export function collectUploads(
  params,
  { reference = ({ name }) => `attach://${name}`, opaque = () => false } = {}
) {
  const files = [];
  const visit = valueMapper(
    (value, next) => {
      if (!(value instanceof InputFile) && opaque(value)) {
        return value;
      }
      const input = attachment(value);
      if (input) {
        if (files.length >= 1000) {
          throw new RangeError('Bot API upload exceeds file limit');
        }
        const name = `file${files.length}`;
        const file = { name, input, mimeType: value.mimeType };
        file.reference = reference(file);
        files.push(file);
        return file.reference;
      }
      return value && typeof value === 'object'
        ? mapObjectValues(value, next)
        : value;
    },
    { label: 'Bot API' }
  );
  return { fields: visit(params), files };
}

/** Sequential consumption shares one aggregate byte budget across attachments. */
export async function* readUploads(files, { maxBytes, signal, fetch }) {
  validateByteLimit(maxBytes);
  let used = 0;
  for (const file of files) {
    const bytes = await readInputFile(file.input, {
      maxBytes: maxBytes - used,
      signal,
      fetch,
    });
    used += bytes.byteLength;
    yield {
      ...file,
      bytes,
      mimeType:
        file.mimeType ??
        file.input.fileData?.type ??
        'application/octet-stream',
    };
  }
  signal?.throwIfAborted();
}

export async function uploadBody(params, settings) {
  validateByteLimit(settings.maxBytes);
  const { fields, files } = collectUploads(params);
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
  for await (const { name, input, mimeType, bytes } of readUploads(
    files,
    settings
  )) {
    body.append(
      name,
      new globalThis.Blob([bytes], { type: mimeType }),
      input.filename ?? 'file'
    );
  }
  return { body };
}
