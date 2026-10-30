// Map public wrapper argument sources to independent Bot API wire fields.
const quote = (value) => JSON.stringify(value);
const argumentType = (method, field) =>
  `BotArgument<${quote(method)}, ${quote(field)}>`;
const fieldNames = (entry) =>
  entry.fields.filter((field) => field.key).map((field) => field.key);
function objectArgument(method, fields, facts) {
  const grouped = new Map();
  for (const field of fields) {
    const path = field.from.slice(1);
    if (!grouped.has(path[0])) {
      grouped.set(path[0], []);
    }
    grouped.get(path[0]).push({ ...field, from: [0, ...path.slice(1)] });
  }
  return `{${[...grouped]
    .map(([key, children]) => {
      const leaf = children.length === 1 && children[0].from.length === 1;
      return `${quote(key)}${leaf && facts.fields.find((field) => field.name === children[0].key)?.optional ? '?' : ''}: ${leaf ? argumentType(method, children[0].key) : objectArgument(method, children, facts)};`;
    })
    .join('\n')}}`;
}
function typeOf(method, entry, arg, index, facts) {
  const fields = entry.fields.filter((field) => field.from?.[0] === index);
  if (fields.some((field) => field.from.length > 1)) {
    return objectArgument(method, fields, facts);
  }
  if (fields.length === 1) {
    return argumentType(method, fields[0].key);
  }
  const spread = entry.fields.find((field) => field.spread === index);
  if (!spread) {
    throw new Error(`Unreviewed wrapper argument: ${method}.${arg.name}`);
  }
  if (spread.format === 'text') {
    return 'string | TextWithEntities';
  }
  const omitted = fieldNames(entry).map(quote).join(' | ') || 'never';
  const remaining = `BotOther<${quote(method)}, ${omitted}>`;
  return arg.name === 'extra' ? `Partial<${remaining}>` : remaining;
}
export function telegrafSignature(name, entry, methods) {
  const method =
    entry.method === 'getChatMembersCount'
      ? 'getChatMemberCount'
      : entry.method;
  const facts = methods.get(method);
  if (!facts) {
    throw new Error(`Missing official method contract: ${method}`);
  }
  const args = entry.args.map((arg, index) => {
    const fields = entry.fields.filter((field) => field.from?.[0] === index);
    const direct = fields.length === 1 && fields[0].from.length === 1;
    const optional = Object.hasOwn(arg, 'default') || arg.name === 'extra';
    const field =
      direct && facts.fields.find((value) => value.name === fields[0].key);
    return {
      name: arg.name,
      type: typeOf(method, entry, arg, index, facts),
      optional,
      maybeOptional: optional || Boolean(field?.optional),
    };
  });
  const tuple = args
    .map((arg, index) => {
      const optional =
        arg.maybeOptional &&
        args.slice(index).every((next) => next.maybeOptional);
      return `${arg.name}${optional ? '?' : ''}: ${arg.type}`;
    })
    .join(', ');
  return {
    declaration: `${name}: [${tuple}];`,
    result: `${name}: ${quote(method)};`,
  };
}
export function telegrafTypeTemplate(declarations, routes) {
  const tuples = new Map();
  const signatures = declarations.map((declaration) => {
    const colon = declaration.indexOf(':');
    const name = declaration.slice(0, colon);
    const tuple = declaration.slice(colon + 1);
    if (tuples.has(tuple)) {
      return `${name}: Signatures[${quote(tuples.get(tuple))}];`;
    }
    tuples.set(tuple, name);
    return declaration;
  });
  return `import type { RequestOptions, TextWithEntities } from './index.js';
import type { BotApiResult, BotArgument, BotOther } from './bot-api-types.js';
interface Signatures {${signatures.join('\n')}}
interface Routes {${routes.join('\n')}}
export type TelegrafPositionalArguments<K extends keyof Signatures> = [...Signatures[K], request?: RequestOptions | AbortSignal];
export type TelegrafPositionalResult<K extends keyof Signatures> = BotApiResult<Routes[K]>;
export type TelegrafPositionalApi = { [M in keyof Signatures]: (...args: TelegrafPositionalArguments<M>) => Promise<TelegrafPositionalResult<M>>; };
`;
}
