import assert from 'node:assert/strict';
import { Anygram, createAdapter } from '../src/index.js';

// Finite random-access source: at most 17 half-MiB parts, without a whole file.
let active = 0,
  maximum = 0,
  reads = 0,
  closed = 0;
const client = new Anygram({
  adapters: [
    createAdapter(
      'native',
      {
        call: async (method, params) => {
          assert.equal(method, 'upload.saveFilePart');
          assert(params.bytes.length <= 512 * 1024);
          active++;
          maximum = Math.max(maximum, active);
          await new Promise((resolve) => globalThis.setImmediate(resolve));
          active--;
          return true;
        },
      },
      { kind: 'mtproto' }
    ),
  ],
});
const upload = await client.uploadFile(
  {
    name: 'finite.bin',
    size: 17 * 512 * 1024,
    read: (offset, length) => {
      reads++;
      return new Uint8Array(length).fill(offset % 251);
    },
    close: () => {
      closed++;
    },
  },
  { workers: 16 }
);
assert.equal(upload.parts, 17);
assert.equal(maximum, 16);
assert.deepEqual([active, reads, closed], [0, 17, 1]);
console.log(
  JSON.stringify({
    maximum,
    reads,
    closed,
    maxRssKiB: process.resourceUsage().maxRSS,
  })
);
