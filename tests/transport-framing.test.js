import { it } from 'test-anywhere';
import assert from 'node:assert/strict';
import * as protocol from '../src/mtproto.js';

function plainPacket(length = 32) {
  const packet = Buffer.alloc(20 + length);
  packet.writeInt32LE(length, 16);
  packet.fill(0x42, 20);
  return packet;
}

it('frames fragmented and coalesced TCP packets in all four Telegram formats', () => {
  for (const mode of ['abridged', 'intermediate', 'padded', 'full']) {
    const writer = new protocol.TransportFraming({
      mode,
      random: (n) => Buffer.alloc(n, 3),
    });
    const reader = new protocol.TransportFraming({ mode });
    const payloads = [plainPacket(), plainPacket(512), plainPacket(1024)];
    const bytes = Buffer.concat(
      payloads.map((packet) => writer.encode(packet))
    );
    const decoded = [];
    for (let offset = 0; offset < bytes.length; offset += 7) {
      decoded.push(...reader.push(bytes.subarray(offset, offset + 7)));
    }
    assert.deepEqual(decoded, payloads);
    const batchReader = new protocol.TransportFraming({ mode });
    assert.deepEqual(batchReader.push(bytes), payloads);
  }
});

it('matches known framing bytes and validates full-transport CRC and sequence', () => {
  const payload = Buffer.from('01020304', 'hex');
  const abridged = new protocol.TransportFraming({ mode: 'abridged' });
  const intermediate = new protocol.TransportFraming({ mode: 'intermediate' });
  const full = new protocol.TransportFraming({ mode: 'full' });
  assert.equal(abridged.header.toString('hex'), 'ef');
  assert.equal(intermediate.header.toString('hex'), 'eeeeeeee');
  assert.equal(full.header.length, 0);
  assert.equal(abridged.encode(payload).toString('hex'), '0101020304');
  assert.equal(
    intermediate.encode(payload).toString('hex'),
    '0400000001020304'
  );
  const packet = full.encode(payload);
  assert.equal(packet.readUInt32LE(0), 16);
  assert.equal(packet.readUInt32LE(4), 0);
  const corrupted = Buffer.from(packet);
  corrupted[8] ^= 1;
  assert.throws(
    () => new protocol.TransportFraming({ mode: 'full' }).push(corrupted),
    /crc/i
  );
  assert.deepEqual(
    new protocol.TransportFraming({ mode: 'full' }).push(packet),
    [payload]
  );
  assert.throws(
    () =>
      new protocol.TransportFraming({ mode: 'full' }).push(
        full.encode(payload)
      ),
    /sequence/i
  );
});

it('rejects oversized frames before buffering bodies and recognizes transport errors', () => {
  const reader = new protocol.TransportFraming({
    mode: 'intermediate',
    maxBytes: 64,
  });
  const huge = Buffer.alloc(4);
  huge.writeUInt32LE(65);
  assert.throws(() => reader.push(huge), /limit|large/i);
  const error = Buffer.alloc(4);
  error.writeInt32LE(-404);
  const writer = new protocol.TransportFraming({ mode: 'intermediate' });
  assert.throws(
    () =>
      new protocol.TransportFraming({ mode: 'intermediate' }).push(
        writer.encode(error)
      ),
    (e) => e.code === 404
  );
  assert.throws(() => writer.encode(Buffer.alloc(3)), /align|multiple/i);
  assert.throws(() => new protocol.TransportFraming({ maxBytes: 0 }), /limit/i);
});

it('separates quick acknowledgements from payloads and bounds buffered data', () => {
  for (const mode of ['abridged', 'intermediate']) {
    const tokens = [];
    const reader = new protocol.TransportFraming({
      mode,
      onQuickAck: (token) => tokens.push(token),
      maxBytes: 64,
    });
    const ack = Buffer.alloc(4);
    if (mode === 'abridged') {
      ack.writeUInt32BE(0x80001234);
    } else {
      ack.writeUInt32LE(0x80001234);
    }
    const writer = new protocol.TransportFraming({ mode });
    assert.deepEqual(
      reader.push(Buffer.concat([ack, writer.encode(plainPacket())])),
      [plainPacket()]
    );
    assert.deepEqual(tokens, [0x80001234]);
    assert.throws(() => reader.push(Buffer.alloc(200)), /limit|large/i);
  }
});

it('matches actual GramJS abridged and full encoders across multiple packets', async () => {
  await import('telegram');
  const { AbridgedPacketCodec } =
    await import('telegram/network/connection/TCPAbridged.js');
  const { FullPacketCodec } =
    await import('telegram/network/connection/TCPFull.js');
  for (const [mode, Reference] of [
    ['abridged', AbridgedPacketCodec],
    ['full', FullPacketCodec],
  ]) {
    const native = new protocol.TransportFraming({ mode });
    const reference = new Reference({});
    for (const bytes of [plainPacket(), plainPacket(512), plainPacket(1024)]) {
      assert.deepEqual(native.encode(bytes), reference.encodePacket(bytes));
    }
  }
});

it('removes every legal padding length from plain/encrypted packets and padded quick ACKs', () => {
  for (let padding = 0; padding < 16; padding++) {
    const writer = new protocol.TransportFraming({
      mode: 'padded',
      random: (n) => Buffer.alloc(n, padding),
    });
    const reader = new protocol.TransportFraming({ mode: 'padded' });
    const encrypted = Buffer.alloc(72, 42);
    assert.deepEqual(reader.push(writer.encode(plainPacket())), [
      plainPacket(),
    ]);
    assert.deepEqual(reader.push(writer.encode(encrypted)), [encrypted]);
  }
  const ack = Buffer.alloc(12);
  ack.writeUInt32LE(8);
  ack.writeUInt32LE(0xffffffff, 4);
  ack.writeUInt32LE(0x81234567, 8);
  const tokens = [];
  const reader = new protocol.TransportFraming({
    mode: 'padded',
    onQuickAck: (token) => tokens.push(token),
  });
  assert.deepEqual(reader.push(ack), []);
  assert.deepEqual(tokens, [0x81234567]);
});
