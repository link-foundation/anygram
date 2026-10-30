import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { screenshotScenario } from './screenshot-scenario.mjs';

const before = await screenshotScenario({ migrated: false });
const result = await screenshotScenario();
if (before.bytes || !result.bytes || result.foreground < 1000) {
  throw new Error('Static terminal screenshot regression');
}
const root = new globalThis.URL('../../docs/screenshots/', import.meta.url);
await writeFile(new globalThis.URL('terminal-static.png', root), result.bytes);
await writeFile(
  new globalThis.URL('terminal-static.json', root),
  `${JSON.stringify(
    {
      before: { photoCalls: 0 },
      after: {
        photoCalls: result.app.calls.filter(
          ({ method }) => method === 'sendPhoto'
        ).length,
        width: result.width,
        height: result.height,
        foregroundPixels: result.foreground,
        bytes: result.bytes.length,
        sha256: createHash('sha256').update(result.bytes).digest('hex'),
      },
    },
    null,
    2
  )}\n`
);
console.log(
  'Saved actual uploaded static terminal PNG and before/after evidence'
);
