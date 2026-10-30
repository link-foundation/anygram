// Loaded only when the caller explicitly selects an installed mtcute backend.
import { camel, objectRequest } from './requests.js';
let runtime;
export async function mtcuteRequest(request) {
  runtime ??= Promise.all([
    import('@mtcute/core'),
    import('@mtcute/core/tl/api-schema.json', { with: { type: 'json' } }),
  ]).then(([{ Long }, { default: schema }]) => ({
    Long,
    definitions: new Map(schema.e.map((item) => [item.name, item])),
  }));
  const { Long, definitions } = await runtime;
  function convert(value, type) {
    if (Array.isArray(value)) {
      return value.map((entry) => convert(entry, type));
    }
    if (type === 'long') {
      return Long.fromString(String(value));
    }
    if (type === 'int53') {
      const number = Number(value);
      if (!Number.isSafeInteger(number)) {
        throw new RangeError('mtcute requires safe 53-bit peer IDs');
      }
      return number;
    }

    if (!value || typeof value !== 'object' || value instanceof Uint8Array) {
      return value;
    }
    const definition = definitions.get(value._);
    const types = new Map(
      definition?.arguments.map((field) => [field.name, field.type])
    );
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        camel(key),
        convert(entry, types.get(key)),
      ])
    );
  }
  return convert(objectRequest(request));
}
