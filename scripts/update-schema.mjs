// Rebuild the independent TL registry from Telegram's own desktop schema.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';

const directory = 'Telegram/SourceFiles/mtproto/scheme';
const commit = execFileSync(
  'gh',
  ['api', 'repos/telegramdesktop/tdesktop/commits/dev', '--jq', '.sha'],
  { encoding: 'utf8' }
).trim();
const registry = {
  layer: 0,
  source: `https://github.com/telegramdesktop/tdesktop/tree/${commit}/${directory}`,
  constructors: [],
  methods: [],
};
for (const fileName of ['api', 'mtproto']) {
  const envelope = JSON.parse(
    execFileSync(
      'gh',
      [
        'api',
        `repos/telegramdesktop/tdesktop/contents/${directory}/${fileName}.tl?ref=${commit}`,
      ],
      { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }
    )
  );
  const source = Buffer.from(envelope.content, 'base64').toString();
  let section = 'constructors';
  for (const line of source.split('\n')) {
    if (line.includes('// LAYER ')) {
      registry.layer = Number(line.match(/LAYER (\d+)/)[1]);
    }
    if (line.includes('---functions---')) {
      section = 'methods';
    }
    if (line.includes('---types---')) {
      section = 'constructors';
    }
    const match = /^([\w.]+)#([a-f0-9]+)\s*(.*?)\s*=\s*([\w<> .]+);/.exec(line);
    if (!match) {
      continue;
    }
    const [, name, hex, fields, type] = match;
    const params = [...fields.matchAll(/([\w]+):([\w.!?#<>]+)/g)]
      .filter((field) => field[2] !== 'Type')
      .map((field) => ({
        name: field[1],
        type:
          fileName === 'mtproto' &&
          [
            'pq',
            'p',
            'q',
            'encrypted_answer',
            'encrypted_data',
            'dh_prime',
            'g_a',
            'g_b',
          ].includes(field[1])
            ? 'bytes'
            : field[2],
      }));
    registry[section].push({
      id: String(parseInt(hex, 16)),
      [section === 'methods' ? 'method' : 'predicate']: name,
      params,
      type,
    });
  }
}
mkdirSync('src/schema', { recursive: true });
writeFileSync('src/schema/telegram.json', `${JSON.stringify(registry)}\n`);
console.log(
  `Layer ${registry.layer}: ${registry.constructors.length} constructors, ${registry.methods.length} methods; ${commit}`
);
