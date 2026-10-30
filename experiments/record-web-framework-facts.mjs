import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const root = new globalThis.URL('../', import.meta.url);
const manifestPath = 'experiments/bot-framework-runtime/package.json';
const manifest = JSON.parse(
  await readFile(new globalThis.URL(manifestPath, root))
);
const installed = [];
for (const name of Object.keys({
  ...manifest.dependencies,
  ...manifest.devDependencies,
})) {
  const file = `experiments/bot-framework-runtime/node_modules/${name}/package.json`;
  const bytes = await readFile(new globalThis.URL(file, root));
  installed.push({
    name,
    version: JSON.parse(bytes).version,
    file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const facts = {
  retrieved: new Date().toISOString(),
  sources: [
    'https://expressjs.com/en/5x/api/',
    'https://koajs.com/',
    'https://fastify.dev/docs/latest/Reference/Routes/',
    'https://fastify.dev/docs/latest/Reference/Reply/#hijack',
    'https://hono.dev/docs/getting-started/nodejs',
    'https://hono.dev/docs/middleware/builtin/body-limit',
    'https://grammy.dev/guide/deployment-types#webhooks',
    'https://telegraf.js.org/',
    'https://github.com/feathers-studio/telegraf-docs/blob/master/examples/webhook/koa.ts',
    'https://github.com/feathers-studio/telegraf-docs/blob/master/examples/webhook/fastify.ts',
  ],
  installed,
  comparisons: {
    grammy: {
      version: '1.46.0',
      frameworks: ['express', 'koa', 'fastify', 'hono'],
    },
    telegraf: { version: '4.16.3', frameworks: ['express', 'koa', 'fastify'] },
    commonModes: [
      'reply',
      'empty',
      'unauthorized',
      'concurrent',
      'failure',
      'malformed',
      'oversized',
    ],
    totalIntegrationCases: 71,
    frozenSource: '88f3c2e4a501169cecf4a6ad8476c942104040dc',
    frozenProbe: { cases: 24, failures: 4 },
  },
  limits: {
    perServerRequests: 32,
    frameworkBodyBytes: 16384,
    largestFiniteRequestBytes: 32796,
    clientDeadlineMilliseconds: 3000,
    serverRequestDeadlineMilliseconds: 5000,
    socketIdleDeadlineMilliseconds: 3000,
    focusedOwnedBodyBytes: 256,
    focusedWebhookDeadlineMilliseconds: 10,
    testDeadlineMilliseconds: 10000,
  },
  differences: [
    'The pinned Hono SDK adapter JSON-encodes an already serialized reply. Both clients return a JSON object through the Fetch adapter instead.',
    'grammY applies bot.catch only to polling; the shared Bot retains its documented direct-dispatch catcher. HTTP comparison boundaries unwrap original errors.',
    'Concurrent SDK callbacks may invoke init twice before the first await settles; the owned callback shares one pending initialization.',
    'Telegraf closes Node webhook responses on handler failure, so these default callbacks acknowledge with an empty response even when the handler rejects.',
    'Koa needs explicit successful status and Node response ownership; Fastify needs hijacking and transfer of its parsed body to the raw request in this Node-style bridge.',
  ],
};
await writeFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/web-frameworks.json',
    root
  ),
  `${JSON.stringify(facts, null, 2)}\n`
);
