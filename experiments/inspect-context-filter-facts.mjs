import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'espree';

const root = new globalThis.URL('../', import.meta.url);
const bytes = readFileSync(
  new globalThis.URL('node_modules/grammy/out/filter.js', root)
);
if (bytes.length > 64 * 1024) {
  throw new RangeError('Filter facts source exceeds its finite budget');
}
const version = JSON.parse(
  readFileSync(new globalThis.URL('node_modules/grammy/package.json', root))
).version;
if (version !== '1.46.0') {
  throw new Error('Expected pinned grammY 1.46.0');
}
const constants = new Map();
function fact(node) {
  switch (node.type) {
    case 'Identifier':
      if (!constants.has(node.name)) {
        throw new Error(`Unknown filter fact: ${node.name}`);
      }
      return constants.get(node.name);
    case 'Literal':
      return node.value;
    case 'ArrayExpression':
      return node.elements.map(fact);
    case 'ObjectExpression':
      return Object.assign(
        {},
        ...node.properties.map((property) =>
          property.type === 'SpreadElement'
            ? fact(property.argument)
            : {
                [property.key.name ?? property.key.value]: fact(property.value),
              }
        )
      );
    default:
      throw new Error(`Not a declarative filter fact: ${node.type}`);
  }
}
const tree = parse(bytes.toString('utf8'), { ecmaVersion: 'latest' });
for (const node of tree.body) {
  if (node.type !== 'VariableDeclaration') {
    continue;
  }
  for (const item of node.declarations) {
    if (item.id.name.endsWith('_KEYS') || item.id.name.endsWith('_SHORTCUTS')) {
      constants.set(item.id.name, fact(item.init));
    }
  }
}
const nodes = [];
function intern(object) {
  const text = Object.entries(object)
    .map(([key, value]) => `${key}@${intern(value)}`)
    .join(' ');
  let index = nodes.indexOf(text);
  if (index < 0) {
    index = nodes.push(text) - 1;
  }
  return index;
}
const result = {
  library: 'grammy',
  version,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  root: intern(constants.get('UPDATE_KEYS')),
  nodes,
  shortcuts: [constants.get('L1_SHORTCUTS'), constants.get('L2_SHORTCUTS')],
};
writeFileSync(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/grammy-filter-facts.json',
    root
  ),
  `${JSON.stringify(result, null, 2)}\n`
);
console.log(`Archived ${nodes.length} interned public filter-key groups`);
