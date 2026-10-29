import { pathToFileURL } from 'node:url';
import { aesIge } from '../src/crypto.js';

/** Count public Buffer allocation/copy bytes during a synchronous operation. */
export function allocatedBufferBytes(operation) {
  let bytes = 0;
  const originals = [
    [Buffer, 'from'],
    [Buffer, 'alloc'],
    [Buffer.prototype, 'map'],
  ].map(([target, name]) => ({ target, name, value: target[name] }));
  try {
    for (const { target, name, value } of originals) {
      target[name] = function (...args) {
        const result = value.apply(this, args);
        bytes += result.length;
        return result;
      };
    }
    const result = operation();
    return { result, bytes };
  } finally {
    for (const { target, name, value } of originals) {
      target[name] = value;
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const input = Buffer.alloc(1024 * 1024, 37);
  const key = Buffer.alloc(32, 7);
  const iv = Buffer.alloc(32, 11);
  const started = globalThis.performance.now();
  const measured = allocatedBufferBytes(() => aesIge(input, key, iv));
  console.log(
    JSON.stringify({
      inputBytes: input.length,
      publicBufferAllocationBytes: measured.bytes,
      milliseconds: globalThis.performance.now() - started,
    })
  );
}
