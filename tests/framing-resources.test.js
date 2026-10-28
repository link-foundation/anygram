import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import { fragmentedProbe } from '../experiments/framing-resources.mjs';
import { TransportFraming, WebSocketFraming } from '../src/mtproto.js';

it('bounds packet assembly copies under adversarial TCP fragmentation', () => {
  const result = fragmentedProbe('tcp');
  assert(
    result.copied <= result.size * 8,
    `Copied ${result.copied} bytes for ${result.size}`
  );
});

it('bounds packet assembly copies under adversarial WebSocket fragmentation', () => {
  const result = fragmentedProbe('websocket');
  assert(
    result.copied <= result.size * 8,
    `Copied ${result.copied} bytes for ${result.size}`
  );
});

it('preserves retained frames and incomplete data when receive buffers compact and reuse storage', () => {
  for (const websocket of [false, true]) {
    const writer = websocket
      ? new WebSocketFraming({ client: false })
      : new TransportFraming();
    const reader = websocket ? new WebSocketFraming() : new TransportFraming();
    const first = Buffer.alloc(32, 42);
    const second = Buffer.alloc(1004, 43);
    const wire = writer.encode(second);
    const initial = Buffer.concat([
      writer.encode(first),
      wire.subarray(0, 300),
    ]);
    const [saved] = reader.push(initial);
    initial.fill(0);
    const [next] = reader.push(wire.subarray(300));
    // A later frame reuses the same small allocation.
    reader.push(writer.encode(Buffer.alloc(32, 44)));
    assert.deepEqual(websocket ? saved.payload : saved, first);
    assert.deepEqual(websocket ? next.payload : next, second);
    assert.deepEqual(reader.push(Buffer.alloc(0)), []);
  }
});
