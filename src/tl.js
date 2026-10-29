import schema from './schema/telegram.json' with { type: 'json' };
import { requestOf, objectRequest } from './requests.js';
import { fixedIntegerBytes, joinBytes } from './bytes.js';

const VECTOR = 0x1cb5c415;
const optional = (type) => /^(\w+)\.(\d+)\?(.+)$/.exec(type);
const vector = (type) => /^(Vector|vector)<(.+)>$/.exec(type);
const present = (value, type) =>
  type === 'true' ? value === true : value !== undefined && value !== null;

function checkedVector(codec, type, depth) {
  if (depth > codec.maxDepth) {
    throw new RangeError('TL depth limit exceeded');
  }
  return vector(type);
}

export class TlCodec {
  constructor({
    registry = schema,
    maxVector = 100000,
    maxDepth = 64,
    maxBytes = 16 * 1024 * 1024,
  } = {}) {
    this.layer = registry.layer;
    this.maxVector = maxVector;
    this.maxDepth = maxDepth;
    this.maxBytes = maxBytes;
    this.methods = new Map(registry.methods.map((item) => [item.method, item]));
    this.constructors = new Map(
      registry.constructors.map((item) => [item.predicate, item])
    );
    this.ids = new Map(
      [...registry.methods, ...registry.constructors].map((item) => [
        Number(item.id) >>> 0,
        item,
      ])
    );
  }

  encode(object, type = 'Object') {
    const writer = new TlWriter(this);
    writer.write(type, object, 0);
    return writer.finish();
  }

  decode(bytes, type = 'Object') {
    const reader = new TlReader(this, bytes);
    const result = reader.read(type, 0);
    if (reader.offset !== bytes.length) {
      throw new RangeError('Trailing bytes after TL value');
    }
    return result;
  }
}

export class TlWriter {
  constructor(codec) {
    this.codec = codec;
    this.parts = [];
    this.length = 0;
  }

  push(bytes) {
    this.length += bytes.length;
    if (this.length > this.codec.maxBytes) {
      throw new RangeError('TL message exceeds byte limit');
    }
    this.parts.push(bytes);
  }

  number(value, size, setter) {
    const bytes = new Uint8Array(size);
    new DataView(bytes.buffer)[setter](0, value, true);
    this.push(bytes);
  }

  bytes(value) {
    if (!(value instanceof Uint8Array) || value.length > 0xffffff) {
      throw new TypeError('Expected TL bytes with length at most 0xffffff');
    }
    const size = value.length;
    const prefix =
      size < 254
        ? new Uint8Array([size])
        : new Uint8Array([
            254,
            size & 255,
            (size >> 8) & 255,
            (size >> 16) & 255,
          ]);
    this.push(prefix);
    this.push(value);
    this.push(new Uint8Array((4 - ((prefix.length + size) % 4)) % 4));
  }

  write(type, value, depth = 0) {
    const list = checkedVector(this.codec, type, depth);
    if (list) {
      if (!Array.isArray(value) || value.length > this.codec.maxVector) {
        throw new RangeError('Invalid TL vector length');
      }
      if (list[1] === 'Vector') {
        this.number(VECTOR, 4, 'setUint32');
      }
      this.number(value.length, 4, 'setInt32');
      for (const item of value) {
        this.write(list[2], item, depth + 1);
      }
      return;
    }
    if (Object.hasOwn(writers, type)) {
      writers[type](this, value);
      return;
    }
    this.object(type, value, depth);
  }

  object(type, value, depth) {
    const request = objectRequest(requestOf(value));
    const definition =
      this.codec.methods.get(request._) ??
      this.codec.constructors.get(request._);
    if (!definition) {
      throw new TypeError(`Unknown TL constructor ${request._}`);
    }
    checkType(type, definition);
    if (type !== definition.predicate) {
      this.number(Number(definition.id), 4, 'setUint32');
    }
    const flags = {};
    for (const field of definition.params) {
      if (field.type === '#') {
        flags[field.name] = 0;
      }
      const match = optional(field.type);
      if (match && present(request[field.name], match[3])) {
        flags[match[1]] |= 1 << Number(match[2]);
      }
    }
    for (const field of definition.params) {
      const match = optional(field.type);
      if (match && !(flags[match[1]] & (1 << Number(match[2])))) {
        continue;
      }
      const fieldType = match ? match[3] : field.type;
      const entry =
        field.type === '#' ? flags[field.name] : request[field.name];
      if (entry === undefined || entry === null) {
        throw new TypeError(`Missing ${request._}.${field.name}`);
      }
      this.write(fieldType, entry, depth + 1);
    }
  }

  finish() {
    return joinBytes(this.parts, this.length);
  }
}

export class TlReader {
  constructor(codec, bytes) {
    if (!(bytes instanceof Uint8Array) || bytes.length > codec.maxBytes) {
      throw new RangeError('Invalid TL input length');
    }
    this.codec = codec;
    this.bytes = bytes;
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    this.offset = 0;
  }

  take(length) {
    if (length < 0 || this.offset + length > this.bytes.length) {
      throw new RangeError('Truncated TL data');
    }
    const result = this.bytes.subarray(this.offset, this.offset + length);
    this.offset += length;
    return result;
  }

  number(size, getter) {
    const offset = this.offset;
    this.take(size);
    return this.view[getter](offset, true);
  }

  byteString() {
    let length = this.number(1, 'getUint8');
    let prefix = 1;
    if (length === 254) {
      const sizes = this.take(3);
      length = sizes[0] | (sizes[1] << 8) | (sizes[2] << 16);
      prefix = 4;
    } else if (length === 255) {
      throw new RangeError('Invalid TL byte-string header');
    }
    const result = Uint8Array.from(this.take(length));
    const padding = this.take((4 - ((length + prefix) % 4)) % 4);
    if (padding.some((byte) => byte !== 0)) {
      throw new RangeError('Invalid TL byte-string padding');
    }
    return result;
  }

  read(type = 'Object', depth = 0) {
    const list = checkedVector(this.codec, type, depth);
    if (list) {
      if (list[1] === 'Vector' && this.number(4, 'getUint32') !== VECTOR) {
        throw new TypeError('Invalid TL vector constructor');
      }
      const length = this.number(4, 'getInt32');
      if (
        length < 0 ||
        length > this.codec.maxVector ||
        length > this.bytes.length - this.offset
      ) {
        throw new RangeError('Invalid TL vector length');
      }
      return Array.from({ length }, () => this.read(list[2], depth + 1));
    }
    if (Object.hasOwn(readers, type)) {
      return readers[type](this);
    }
    return this.object(type, depth);
  }

  object(type, depth) {
    const bare = this.codec.constructors.get(type);
    const id = bare ? Number(bare.id) : this.number(4, 'getUint32');
    if (id === 0x997275b5 || id === 0xbc799737) {
      if (!['Object', 'X', '!X', 'Bool'].includes(type)) {
        throw new TypeError(`Unexpected Bool for TL type ${type}`);
      }
      return id === 0x997275b5;
    }
    const definition = this.codec.ids.get(id);
    if (!definition) {
      throw new TypeError(`Unknown TL constructor 0x${id.toString(16)}`);
    }
    checkType(type, definition);
    const result = { _: definition.predicate ?? definition.method };
    for (const field of definition.params) {
      const match = optional(field.type);
      if (match && !(result[match[1]] & (1 << Number(match[2])))) {
        if (match[3] === 'true') {
          result[field.name] = false;
        }
        continue;
      }
      result[field.name] = this.read(match ? match[3] : field.type, depth + 1);
    }
    return result;
  }
}

function writeInteger(writer, value, unsigned = false) {
  if (
    !Number.isInteger(value) ||
    value < -0x80000000 ||
    value > (unsigned ? 0xffffffff : 0x7fffffff)
  ) {
    throw new RangeError('Invalid TL integer');
  }
  writer.number(value, 4, unsigned ? 'setUint32' : 'setInt32');
}

const writers = {
  true: () => {},
  Bool(writer, value) {
    if (typeof value !== 'boolean') {
      throw new TypeError('Expected TL Bool');
    }
    writer.number(value ? 0x997275b5 : 0xbc799737, 4, 'setUint32');
  },
  int: (writer, value) => writeInteger(writer, value),
  '#': (writer, value) => writeInteger(writer, value, true),
  long(writer, value) {
    if (typeof value === 'number' && !Number.isSafeInteger(value)) {
      throw new RangeError(
        'Long requires a safe integer, bigint or decimal string'
      );
    }
    const number = BigInt(value);
    if (number < -(1n << 63n) || number >= 1n << 63n) {
      throw new RangeError('TL long out of range');
    }
    writer.number(number, 8, 'setBigInt64');
  },
  double: (writer, value) => writer.number(value, 8, 'setFloat64'),
  string(writer, value) {
    if (typeof value !== 'string') {
      throw new TypeError('Expected a TL string');
    }
    writer.bytes(new globalThis.TextEncoder().encode(value));
  },
  bytes: (writer, value) => writer.bytes(value),
  int128: (writer, value) => fixedBytes(writer, value, 16),
  int256: (writer, value) => fixedBytes(writer, value, 32),
};

function fixedBytes(writer, value, length) {
  writer.push(fixedIntegerBytes(value, length));
}

const readers = {
  true: () => true,
  int: (reader) => reader.number(4, 'getInt32'),
  '#': (reader) => reader.number(4, 'getUint32'),
  long: (reader) => reader.number(8, 'getBigInt64'),
  double: (reader) => reader.number(8, 'getFloat64'),
  bytes: (reader) => reader.byteString(),
  string: (reader) =>
    new globalThis.TextDecoder('utf-8', { fatal: true }).decode(
      reader.byteString()
    ),
  int128: (reader) => Uint8Array.from(reader.take(16)),
  int256: (reader) => Uint8Array.from(reader.take(32)),
};

function checkType(type, definition) {
  if (
    !['Object', 'X', '!X', definition.type, definition.predicate].includes(type)
  ) {
    throw new TypeError(
      `Unexpected ${definition.predicate ?? definition.method} for TL type ${type}`
    );
  }
}
