import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { parse } from 'espree';

const root = new globalThis.URL('../', import.meta.url);
const path = new globalThis.URL('node_modules/grammy/out/core/api.js', root);
const bytes = readFileSync(path);
if (bytes.length > 256 * 1024) {
  throw new RangeError('Bot signature source exceeds its finite budget');
}
const version = JSON.parse(
  readFileSync(new globalThis.URL('node_modules/grammy/package.json', root))
).version;
if (version !== '1.46.0') {
  throw new Error('Expected pinned grammY 1.46.0');
}
const tree = parse(bytes.toString('utf8'), { ecmaVersion: 'latest' });
const api = tree.body.find(
  (node) => node.type === 'ClassDeclaration' && node.id.name === 'Api'
);
const methods = {};
for (const entry of api.body.body) {
  if (entry.kind === 'constructor') {
    continue;
  }
  const body = entry.value.body.body;
  const call =
    body.length === 1 && body[0].type === 'ReturnStatement' && body[0].argument;
  const target = call?.callee?.object;
  const raw =
    call?.type === 'CallExpression' &&
    target?.type === 'MemberExpression' &&
    target.object.type === 'ThisExpression' &&
    target.property.name === 'raw';
  const name = entry.key.name;
  const args = entry.value.params.map(
    (value) => value.name ?? `...${value.argument?.name}`
  );
  const payload = call?.arguments?.[0];
  const fields =
    payload?.type === 'ObjectExpression'
      ? payload.properties.map((property) =>
          property.type === 'SpreadElement'
            ? `...${property.argument.name}`
            : `${property.key.name}:${property.value.name}`
        )
      : null;
  methods[name] = {
    args,
    method: raw ? call.callee.property.name : null,
    fields,
    shape: payload?.type ?? null,
  };
}
const result = {
  library: 'grammy',
  version,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  methods,
};
writeFileSync(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/grammy-bot-signatures.json',
    root
  ),
  `${JSON.stringify(result, null, 2)}\n`
);
console.log(`${Object.keys(methods).length} public method signatures`);
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.entries(methods).filter(([, value]) => !value.fields)
    ),
    null,
    2
  )
);
