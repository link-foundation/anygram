// Finite fragmentation/copy probe. Run with --max-old-space-size=128.
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { pathToFileURL } from 'node:url';
import { TransportFraming, WebSocketFraming } from '../src/mtproto.js';

/** Count public Buffer/TypedArray copy operations only during a synchronous probe. */
export function measureCopies(run) {
  let copied = 0;
  const concat = Buffer.concat;
  const copy = Buffer.prototype.copy;
  const set = Uint8Array.prototype.set;
  Buffer.concat = function (list, length) {
    copied +=
      length ?? list.reduce((total, bytes) => total + bytes.byteLength, 0);
    return concat.call(this, list, length);
  };
  Buffer.prototype.copy = function (...args) {
    const length = copy.apply(this, args);
    copied += length;
    return length;
  };
  Uint8Array.prototype.set = function (bytes, offset) {
    copied += bytes.byteLength;
    return set.call(this, bytes, offset);
  };
  const started = performance.now();
  try {
    const result = run();
    return { copied, milliseconds: performance.now() - started, result };
  } finally {
    Buffer.concat = concat;
    Buffer.prototype.copy = copy;
    Uint8Array.prototype.set = set;
  }
}

export function fragmentedProbe(kind, size = 256 * 1024, chunk = 128) {
  if (
    !Number.isSafeInteger(size) ||
    size < 4 ||
    size > 4 * 1024 * 1024 ||
    size % 4 ||
    !Number.isSafeInteger(chunk) ||
    chunk < 64 ||
    chunk > size
  ) {
    throw new RangeError(
      'Probe requires 4 B–4 MiB payload and 64 B–payload chunks'
    );
  }
  const payload = Buffer.alloc(size, 42);
  const ws = kind === 'websocket';
  const writer = ws
    ? new WebSocketFraming({ client: false })
    : new TransportFraming();
  const reader = ws ? new WebSocketFraming() : new TransportFraming();
  const encoded = writer.encode(payload);
  const measurement = measureCopies(() => {
    const packets = [];
    for (let offset = 0; offset < encoded.length; offset += chunk) {
      packets.push(...reader.push(encoded.subarray(offset, offset + chunk)));
    }
    return packets;
  });
  assert.equal(measurement.result.length, 1);
  assert.deepEqual(
    ws ? measurement.result[0].payload : measurement.result[0],
    payload
  );
  const { result, ...statistics } = measurement;
  void result;
  return { kind, size, chunk, ...statistics };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  for (const kind of ['tcp', 'websocket']) {
    console.log(fragmentedProbe(kind));
  }
}
