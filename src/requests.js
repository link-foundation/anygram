import schema from './schema/telegram.json' with { type: 'json' };
const definitions = new Map(
  [...schema.methods, ...schema.constructors].map((item) => [
    item.method ?? item.predicate,
    item,
  ])
);
const metadataFields = new Set([
  '_',
  'className',
  'classType',
  'CONSTRUCTOR_ID',
  'SUBCLASS_OF_ID',
  'originalArgs',
]);
const lowerFirst = (text) => text[0].toLowerCase() + text.slice(1);
export const camel = (text) =>
  text.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
export const snake = (text) =>
  text.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export function requestOf(method, params = {}) {
  if (typeof method === 'string') {
    if (!/^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)*$/.test(method)) {
      throw new TypeError('Invalid Telegram method name');
    }
    const parts = method.split('.');
    parts[parts.length - 1] = lowerFirst(parts.at(-1));
    return { method: parts.join('.'), params };
  }
  if (!method || typeof method !== 'object') {
    throw new TypeError('Expected a method name or TL request');
  }
  const name = method._ ?? method.className;
  if (typeof name !== 'string') {
    throw new TypeError('TL requests require _ or className');
  }
  const values = Object.fromEntries(
    Object.entries(method).filter(([key]) => !metadataFields.has(key))
  );
  return { ...requestOf(name, values), original: method };
}

export function gramRequest(Api, request) {
  if (request.original?.getBytes) {
    return request.original;
  }
  function convert(value) {
    if (Array.isArray(value)) {
      return value.map(convert);
    }
    if (value instanceof Uint8Array) {
      return Buffer.from(value);
    }
    if (
      !value ||
      typeof value !== 'object' ||
      value instanceof Uint8Array ||
      value.getBytes
    ) {
      return value;
    }
    const name = value._ ?? value.className;
    const fields = Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !['_', 'className'].includes(key))
        .map(([key, entry]) => [camel(key), convert(entry)])
    );
    return name ? construct(name, fields) : fields;
  }
  function construct(name, fields) {
    const path = name.split('.');
    const last = path.pop();
    path.push(last[0].toUpperCase() + last.slice(1));
    const Constructor = path.reduce((scope, key) => scope?.[key], Api);
    if (!Constructor) {
      throw new TypeError(`The backend schema has no constructor ${name}`);
    }
    const definition = definitions.get(requestOf(name).method);
    for (const field of definition?.params ?? []) {
      if (
        /^int(128|256)$/.test(field.type) &&
        fields[camel(field.name)] instanceof Uint8Array
      ) {
        const bytes = fields[camel(field.name)];
        fields[camel(field.name)] = BigInt(
          `0x${Buffer.from(bytes).reverse().toString('hex')}`
        );
      }
    }
    return new Constructor(fields);
  }
  return construct(request.method, convert(request.params));
}

export function objectRequest(request) {
  function convert(value, name) {
    if (Array.isArray(value)) {
      return value.map((item) => convert(item));
    }
    if (!value || typeof value !== 'object' || value instanceof Uint8Array) {
      return value;
    }
    if (typeof value.toJSNumber === 'function' || value.__isLong__) {
      return BigInt(value.toString());
    }
    const tag =
      name ?? value._ ?? (value.className && requestOf(value.className).method);
    const fields = new Set(
      definitions.get(tag)?.params.map((field) => field.name)
    );
    const result = tag ? { _: tag } : {};
    for (const [key, entry] of Object.entries(value)) {
      if (metadataFields.has(key)) {
        continue;
      }
      result[fields.has(key) ? key : snake(key)] = convert(entry);
    }
    return result;
  }
  return { _: request.method, ...convert(request.params, request.method) };
}

export function methodProxy(invoke, path = []) {
  return new Proxy(() => {}, {
    get(target, key) {
      if (key === 'then' || typeof key === 'symbol') {
        return undefined;
      }
      return methodProxy(invoke, [...path, key]);
    },
    apply(target, receiver, args) {
      return invoke(path.join('.'), ...args);
    },
  });
}
