import schema from './schema/telegram.json' with { type: 'json' };
import { fixedIntegerBytes } from './bytes.js';
// Owned schema classes must be reconstructed with a backend's own runtime.
export const nativeTlObjects = new WeakSet();
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
export const gramClassName = (name) =>
  name
    .split('.')
    .map((part, index, path) =>
      index === path.length - 1
        ? part
            .split('_')
            .map((word) => word[0].toUpperCase() + word.slice(1))
            .join('')
        : part
    )
    .join('.');
const aliases = new Map(
  [...definitions.keys()].flatMap((name) => {
    const className = gramClassName(name);
    const path = className.split('.');
    path[path.length - 1] = lowerFirst(path.at(-1));
    return [
      [className, name],
      [path.join('.'), name],
    ];
  })
);
export const camel = (text) =>
  text.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
export const snake = (text) =>
  text.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

export const schemaDefinition = (name) =>
  definitions.get(aliases.get(name) ?? name);

export function requestOf(method, params = {}) {
  if (typeof method === 'string') {
    if (!/^[a-zA-Z][\w]*(?:\.[a-zA-Z][\w]*)*$/.test(method)) {
      throw new TypeError('Invalid Telegram method name');
    }
    const parts = method.split('.');
    parts[parts.length - 1] = lowerFirst(parts.at(-1));
    return { method: aliases.get(method) ?? parts.join('.'), params };
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

export const requestLimits = Object.freeze({ maxDepth: 64, maxVector: 100000 });
export const mapObjectValues = (value, next) =>
  Object.fromEntries(
    Object.entries(value).map(([key, entry]) => [key, next(entry)])
  );

export function valueMapper(
  visit,
  {
    maxDepth = requestLimits.maxDepth,
    maxVector = requestLimits.maxVector,
    label = 'TL',
  } = {}
) {
  if (
    !Number.isSafeInteger(maxDepth) ||
    maxDepth < 0 ||
    !Number.isSafeInteger(maxVector) ||
    maxVector < 0
  ) {
    throw new RangeError(`Invalid ${label} request limits`);
  }
  function map(value, depth = 0, name) {
    if (depth > maxDepth) {
      throw new RangeError(`${label} depth limit exceeded`);
    }
    if (Array.isArray(value)) {
      if (value.length > maxVector) {
        throw new RangeError(`Invalid ${label} vector length`);
      }
      return value.map((item) => map(item, depth + 1));
    }
    return visit(
      value,
      (entry, childName) => map(entry, depth + 1, childName),
      name
    );
  }
  return map;
}

export function gramRequest(Api, request, limits) {
  if (request.original?.getBytes && !nativeTlObjects.has(request.original)) {
    return request.original;
  }
  const convert = valueMapper((value, next) => {
    if (value instanceof Uint8Array) {
      return Buffer.from(value);
    }
    if (
      !value ||
      typeof value !== 'object' ||
      value instanceof Uint8Array ||
      (value.getBytes && !nativeTlObjects.has(value))
    ) {
      return value;
    }
    const name = value._ ?? value.className;
    const fields = Object.fromEntries(
      Object.entries(value)
        .filter(([key]) => !metadataFields.has(key))
        .map(([key, entry]) => [camel(key), next(entry)])
    );
    return name ? construct(name, fields) : fields;
  }, limits);
  function construct(name, fields) {
    const path = gramClassName(name).split('.');
    const Constructor = path.reduce((scope, key) => scope?.[key], Api);
    if (!Constructor) {
      throw new TypeError(`The backend schema has no constructor ${name}`);
    }
    const definition = definitions.get(requestOf(name).method);
    for (const field of definition?.params ?? []) {
      if (
        integerWidth(field.type) &&
        fields[camel(field.name)] instanceof Uint8Array
      ) {
        const bytes = fixedIntegerBytes(
          fields[camel(field.name)],
          integerWidth(field.type)
        );
        fields[camel(field.name)] = BigInt(
          `0x${Buffer.from(bytes).reverse().toString('hex')}`
        );
      }
    }
    return new Constructor(fields);
  }
  return construct(request.method, convert(request.params));
}

export function objectRequest(request, limits) {
  return {
    _: request.method,
    ...canonicalValue(request.params, limits, request.method),
  };
}

/** Canonicalize complete values so root vectors share the same traversal limits. */
export function canonicalValue(value, limits, name) {
  const convert = valueMapper((value, next, name) => {
    if (!value || typeof value !== 'object' || value instanceof Uint8Array) {
      return value;
    }
    if (typeof value.toJSNumber === 'function' || value.__isLong__) {
      return BigInt(value.toString());
    }
    const rawTag = name ?? value._ ?? value.className;
    const tag = rawTag && requestOf(rawTag).method;
    const fields = new Map(
      definitions.get(tag)?.params.map((field) => [field.name, field.type])
    );
    const result = tag ? { _: tag } : {};
    for (const [key, entry] of Object.entries(value)) {
      if (metadataFields.has(key)) {
        continue;
      }
      const field = fields.has(key) ? key : snake(key);
      result[field] = canonicalField(fields.get(field), next(entry));
    }
    return result;
  }, limits);
  return convert(value, 0, name);
}

function canonicalField(type, value) {
  const width = integerWidth(type);
  return width && value !== undefined && value !== null
    ? fixedIntegerBytes(value, width)
    : value;
}

function integerWidth(type) {
  const match = /^(?:\w+\.\d+\?)?int(128|256)$/.exec(type);
  return match && Number(match[1]) / 8;
}

export function methodProxy(invoke, path = []) {
  return new Proxy(() => {}, {
    get(target, key) {
      if (key === 'then' || key === 'toJSON' || typeof key === 'symbol') {
        return undefined;
      }
      return methodProxy(invoke, [...path, key]);
    },
    apply(target, receiver, args) {
      return invoke(path.join('.'), ...args);
    },
  });
}
