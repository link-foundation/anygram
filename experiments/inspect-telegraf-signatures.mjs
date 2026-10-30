import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'espree';

const root = new globalThis.URL('../', import.meta.url);
const bytes = readFileSync(
  new globalThis.URL('node_modules/telegraf/lib/telegram.js', root)
);
const version = JSON.parse(
  readFileSync(new globalThis.URL('node_modules/telegraf/package.json', root))
).version;
if (bytes.length > 256 * 1024 || version !== '4.16.3') {
  throw new Error('Expected bounded pinned Telegraf 4.16.3 source');
}
const tree = parse(bytes.toString('utf8'), { ecmaVersion: 'latest' });
const telegram = tree.body.find(
  (node) => node.type === 'ClassDeclaration' && node.id.name === 'Telegram'
);

function parameter(node) {
  const value = node.type === 'AssignmentPattern' ? node.left : node;
  const result =
    value.type === 'Identifier'
      ? { name: value.name }
      : { name: 'input', fields: value.properties.map((p) => p.key.name) };
  if (node.type === 'AssignmentPattern') {
    result.default =
      node.right.type === 'ObjectExpression' ? {} : node.right.value;
  }
  return result;
}

function reference(node, args) {
  const index = args.findIndex((arg) => arg.name === node.name);
  if (index >= 0) {
    return [index];
  }
  const object = args.findIndex((arg) => arg.fields?.includes(node.name));
  if (object >= 0) {
    return [object, node.name];
  }
  throw new Error(`Unreviewed argument reference: ${node.name}`);
}

function captionArgument(node) {
  const callee = node.callee;
  if (
    callee?.type !== 'SequenceExpression' ||
    callee.expressions.at(-1)?.property?.name !== 'fmtCaption'
  ) {
    throw new Error('Unreviewed caption helper');
  }
  return node.arguments[0];
}

function fieldValue(node, args) {
  if (node.type === 'Identifier') {
    return { from: reference(node, args) };
  }
  if (node.type === 'Literal') {
    return { value: node.value };
  }
  if (node.type === 'UnaryExpression' && node.operator === '!') {
    return { from: reference(node.argument, args), not: true };
  }
  if (node.type === 'CallExpression') {
    return { from: reference(captionArgument(node), args), format: 'caption' };
  }
  throw new Error(`Unreviewed public payload value: ${node.type}`);
}

function fields(node, args) {
  if (node.type === 'Identifier') {
    return [{ spread: reference(node, args)[0] }];
  }
  if (node.type !== 'ObjectExpression') {
    throw new Error('Unreviewed payload object');
  }
  return node.properties.flatMap((property) => {
    if (property.type !== 'SpreadElement') {
      return { key: property.key.name, ...fieldValue(property.value, args) };
    }
    let value = property.argument;
    if (value.name === 't') {
      return {
        spread: args.findIndex((arg) => arg.name === 'text'),
        format: 'text',
      };
    }
    if (value.type === 'CallExpression') {
      value = captionArgument(value);
      if (value.type === 'ObjectExpression') {
        return fields(value, args);
      }
      return { spread: reference(value, args)[0], format: 'caption' };
    }
    return { spread: reference(value, args)[0] };
  });
}

const methods = {};
for (const entry of telegram.body.body) {
  const name = entry.key.name;
  const args = entry.value.params.map(parameter);
  const body = entry.value.body.body;
  const call = body.at(-1)?.argument;
  if (entry.kind === 'get') {
    methods[name] = { alias: call.property.name };
  } else if (name === 'getFileLink') {
    methods[name] = { args, helper: 'fileLink' };
  } else if (name === 'sendCopy') {
    methods[name] = {
      args,
      method: 'copyMessage',
      fields: [
        { key: 'chat_id', from: [0] },
        { key: 'from_chat_id', from: [1, 'chat', 'id'] },
        { key: 'message_id', from: [1, 'message_id'] },
        { spread: 2, format: 'caption' },
      ],
    };
  } else {
    if (call?.callee?.property?.name !== 'callApi') {
      throw new Error(`Unreviewed public method: ${name}`);
    }
    methods[name] = {
      args,
      method: call.arguments[0].value,
      fields: fields(call.arguments[1], args),
    };
  }
}
const result = {
  library: 'telegraf',
  version,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  methods,
};
writeFileSync(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/telegraf-bot-signatures.json',
    root
  ),
  `${JSON.stringify(result, null, 2)}\n`
);
console.log(`${Object.keys(methods).length} public Telegraf method facts`);
console.log(result.sha256);
