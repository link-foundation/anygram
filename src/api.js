import schema from './schema/telegram.json' with { type: 'json' };
import { TlCodec } from './tl.js';
import { camel, gramClassName, nativeTlObjects } from './requests.js';
import { crc32 } from './bytes.js';
import { randomId } from './random.js';

const codec = new TlCodec();

function defaultRandomId(type, args) {
  if (type === 'int') {
    return Number(BigInt.asIntN(32, randomId()));
  }
  if (type === 'long') {
    return randomId();
  }
  if (type === 'Vector<long>') {
    if (!Array.isArray(args.id) || args.id.length > codec.maxVector) {
      throw new RangeError(
        'Random identifier vector requires bounded message IDs'
      );
    }
    return args.id.map(() => randomId());
  }
  return undefined;
}

function createClass(definition) {
  const className = gramClassName(definition.method ?? definition.predicate);
  const metadata = {
    className,
    classType: definition.method ? 'request' : 'constructor',
    CONSTRUCTOR_ID: Number(definition.id) >>> 0,
    SUBCLASS_OF_ID: crc32(Buffer.from(definition.type)),
  };
  const fields = definition.params.filter((field) => field.type !== '#');
  class SchemaObject {
    constructor(args = {}) {
      if (!args || typeof args !== 'object' || Array.isArray(args)) {
        throw new TypeError('Expected TL class arguments as an object');
      }
      Object.assign(this, metadata);
      this.originalArgs = args;
      for (const field of fields) {
        const key = camel(field.name);
        this[key] = args[key];
        if (
          key === 'randomId' &&
          (this[key] === undefined || this[key] === null)
        ) {
          this[key] = defaultRandomId(field.type, args);
        }
      }
      nativeTlObjects.add(this);
    }

    getBytes() {
      return Buffer.from(codec.encode(this));
    }

    toJSON() {
      return Object.fromEntries([
        ...fields.map((field) => [camel(field.name), this[camel(field.name)]]),
        ['className', className],
      ]);
    }
  }
  Object.assign(SchemaObject, metadata);
  return SchemaObject;
}

/** Class constructors use the same schema and serializer as native plain RPCs. */
export const Api = {};
for (const definition of [...schema.methods, ...schema.constructors]) {
  const path = gramClassName(definition.method ?? definition.predicate).split(
    '.'
  );
  const name = path.pop();
  let scope = Api;
  for (const part of path) {
    scope = scope[part] ??= {};
  }
  scope[name] = createClass(definition);
}
