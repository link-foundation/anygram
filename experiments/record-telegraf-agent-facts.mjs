import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
const root = new globalThis.URL('../', import.meta.url);
const files = [
  'node_modules/telegraf/lib/core/network/client.js',
  'node_modules/telegraf/typings/core/network/client.d.ts',
  'node_modules/telegraf/lib/telegram.js',
];
const installed = [];
for (const file of files) {
  const bytes = await readFile(new globalThis.URL(file, root));
  installed.push({
    file,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}
const facts = {
  retrieved: new Date().toISOString(),
  telegraf: '4.16.3',
  sources: [
    'https://github.com/telegraf/telegraf/blob/v4.16.3/src/core/network/client.ts',
    'https://nodejs.org/download/release/v20.18.3/docs/api/http.html#class-httpagent',
    'https://nodejs.org/download/release/v20.18.3/docs/api/stream.html#streamreadabletowebstreamreadable-options',
  ],
  installed,
  contracts: {
    defaultAgent: {
      protocol: 'https:',
      keepAlive: true,
      keepAliveMsecs: 10000,
      shared: true,
    },
    httpApiRoot:
      'Clears the API agent during construction, including supplied agents',
    attachmentAgent:
      'Independent agent or URL selector used for client-side URL uploads',
    constructor:
      'Telegram(token, options?, response?) exposes per-view settings and response',
    nativeBridge:
      'Node request agents, cancellation and byte-counted Web stream backpressure',
  },
  observedDifferences: [
    {
      runtime: 'Bun 1.4.4',
      library: 'Telegraf 4.16.3',
      evidence: 'tests/telegraf-agent.test.js',
      result:
        'The actual SDK node-fetch shim sends JSON without Agent.addRequest; the owned bridge invokes the selected agent',
    },
    {
      runtime: 'Node 20.18.3',
      evidence: 'experiments/vendor-bot-wire.integration.js',
      result:
        'Actual SDK and owned top-level/nested URL uploads use the attachment URL selector and CA agent, with equal filenames and bytes',
    },
  ],
};
await writeFile(
  new globalThis.URL(
    'docs/case-studies/issue-1/data/telegraf-agents.json',
    root
  ),
  `${JSON.stringify(facts, null, 2)}\n`
);
