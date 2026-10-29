import { readFileSync } from 'node:fs';

// Telegram's published 2048-bit safe prime, retained in the research archive.
const source = readFileSync(
  new globalThis.URL(
    '../docs/case-studies/issue-1/data/security-guidelines.md',
    import.meta.url
  ),
  'utf8'
);
export const telegramDhPrime = Buffer.from(
  source
    .match(/^ {4}((?:[0-9A-F]{2} ){255}[0-9A-F]{2})$/m)[1]
    .replaceAll(' ', ''),
  'hex'
);
export const dhConfig = (random = new Uint8Array(256)) => ({
  _: 'messages.dhConfig',
  p: Uint8Array.from(telegramDhPrime),
  g: 3,
  version: 7,
  random,
});
