import { collectUploads, readUploads, stringify } from './bot-api-upload.js';
import { valueMapper, mapObjectValues } from './requests.js';
import { createRequestScope, validateByteLimit } from './http.js';
import { abortable } from './cancellation.js';
import { TelegramError, UnsupportedError } from './errors.js';

// Vendor instances retain their prototypes and private state. Plain wrappers
// and owned InputFiles still pass through our bounded source reader.
function vendorObject(value) {
  return (
    value &&
    typeof value === 'object' &&
    !(value instanceof Uint8Array) &&
    !(value instanceof globalThis.Blob) &&
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}

async function fileFactory(style) {
  if (style === 'grammy') {
    const { InputFile } = await import('grammy');
    return (file) => new InputFile(file.bytes, file.input.filename);
  }
  if (style === 'node-telegram-bot-api') {
    const { InputFile } = await import('node-telegram-bot-api');
    return (file) =>
      new InputFile(file.bytes, {
        filename: file.input.filename,
        contentType: file.mimeType,
      });
  }
  return (file) => ({
    source: Buffer.from(file.bytes),
    filename: file.input.filename ?? 'file',
  });
}

async function vendorParams(params, style, settings) {
  const legacy = style === 'legacy-node';
  const { fields, files } = collectUploads(params, {
    opaque: vendorObject,
    reference: ({ name }) => (legacy ? `attach://${name}` : Symbol(name)),
  });
  const converted = new Map();
  const createFile = files.length && !legacy ? await fileFactory(style) : null;
  const formData = {};
  for await (const file of readUploads(files, settings)) {
    if (legacy) {
      formData[file.name] = {
        value: Buffer.from(file.bytes),
        options: {
          filename: file.input.filename ?? 'file',
          contentType: file.mimeType,
        },
      };
    } else {
      converted.set(file.reference, createFile(file));
    }
  }
  const visit = valueMapper(
    (value, next) => {
      if (converted.has(value)) {
        return converted.get(value);
      }
      if (vendorObject(value)) {
        return value;
      }
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return value && typeof value === 'object'
        ? mapObjectValues(value, next)
        : value;
    },
    { label: 'Bot API' }
  );
  const mapped = visit(fields);
  if (!legacy) {
    return { params: mapped };
  }
  const form = Object.fromEntries(
    Object.entries(mapped).map(([key, value]) => [
      key,
      value && typeof value === 'object' ? stringify(value) : value,
    ])
  );
  return { params: form, formData };
}

function dispatch(
  { name, client, style },
  method,
  { params, formData },
  options
) {
  const api = client.api ?? client.telegram ?? client;
  if (typeof client.callApi === 'function') {
    return client.callApi(method, params, options);
  }
  if (style === 'grammy') {
    return api.raw[method](params, options?.signal);
  }
  if (typeof api.callApi === 'function') {
    return api.callApi(method, params, options);
  }
  if (typeof api.request === 'function') {
    return api.request(method, params, options?.signal);
  }
  if (typeof api.call === 'function') {
    return api.call(method, params, options);
  }
  if (typeof client._request === 'function') {
    return client._request(method, {
      form: params,
      ...(formData && { formData }),
    });
  }
  throw new UnsupportedError(method, name);
}

export function botRequester(name, client, style, settings) {
  const backend = { name, client, style };
  return async (method, params, options = {}) => {
    options.signal?.throwIfAborted();
    if (style === 'bot') {
      return dispatch(backend, method, { params }, options);
    }
    const maxBytes = settings.maxUploadBytes ?? 64 * 1024 * 1024;
    validateByteLimit(maxBytes);
    const scope = createRequestScope(
      {
        signal: options.signal,
        timeout: options.timeout ?? settings.timeout ?? 30000,
      },
      new TelegramError('Bot API request timed out', { type: 'NETWORK_ERROR' })
    );
    try {
      const legacy =
        style === 'node-telegram-bot-api' &&
        typeof client._request === 'function';
      const prepared = await vendorParams(
        params,
        legacy ? 'legacy-node' : style,
        {
          maxBytes,
          signal: scope.signal,
          fetch: settings.fetch ?? globalThis.fetch,
        }
      );
      return await abortable(
        dispatch(backend, method, prepared, {
          ...options,
          signal: scope.signal,
        }),
        scope.signal
      );
    } finally {
      scope.dispose();
    }
  };
}
