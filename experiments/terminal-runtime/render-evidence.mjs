import { mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { renderScenario } from './render-scenario.mjs';

const root = new globalThis.URL('../../docs/screenshots/', import.meta.url);
mkdirSync(root, { recursive: true });
const evidence = {};
for (const [label, migrated] of [
  ['before', false],
  ['after', true],
]) {
  const result = await renderScenario({ migrated });
  for (const [extension, bytes] of [
    ['png', result.png],
    ['gif', result.bytes],
  ]) {
    const name = `terminal-${label}.${extension}`;
    writeFileSync(new globalThis.URL(name, root), bytes);
    evidence[name] = {
      bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
  }
  evidence[label] = {
    width: result.decoder.width,
    height: result.decoder.height,
    frames: result.decoder.numFrames(),
    foregroundPixels: result.foreground,
  };
}
writeFileSync(
  new globalThis.URL('terminal-rendering.json', root),
  `${JSON.stringify(evidence, null, 2)}\n`
);
console.log('Saved before/after actual PNG/GIF rendering evidence');
