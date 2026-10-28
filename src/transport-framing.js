import { randomBytes } from 'node:crypto';
import { TelegramError } from './errors.js';

const modes = new Set(['abridged', 'intermediate', 'padded', 'full']);
const crcTable = Array.from({ length: 256 }, (_, value) => {
  for (let bit = 0; bit < 8; bit++) {
    value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1;
  }
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = crcTable[(value ^ byte) & 255] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

/** Incremental framing only: TCP/WebSocket message boundaries are irrelevant. */
export class TransportFraming {
  constructor({
    mode = 'intermediate',
    maxBytes = 16 * 1024 * 1024,
    maxPackets = 1000,
    onQuickAck,
    random = randomBytes,
  } = {}) {
    if (!modes.has(mode)) {
      throw new TypeError('Unknown MTProto transport framing');
    }
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 4 ||
      maxBytes > 0x3fffffc
    ) {
      throw new RangeError('Invalid transport byte limit');
    }
    if (!Number.isSafeInteger(maxPackets) || maxPackets < 1) {
      throw new RangeError('Invalid transport packet limit');
    }
    Object.assign(this, { mode, maxBytes, maxPackets, onQuickAck, random });
    this.buffer = Buffer.alloc(0);
    this.outgoing = 0;
    this.incoming = 0;
  }
  get header() {
    if (this.mode === 'abridged') {
      return Buffer.from([0xef]);
    }
    if (this.mode === 'full') {
      return Buffer.alloc(0);
    }
    return Buffer.alloc(4, this.mode === 'padded' ? 0xdd : 0xee);
  }
  encode(bytes) {
    this.validatePayload(bytes);
    const payload = Buffer.from(bytes);
    if (this.mode === 'abridged') {
      const words = payload.length / 4;
      const header = Buffer.alloc(words < 127 ? 1 : 4);
      if (words < 127) {
        header[0] = words;
      } else {
        header[0] = 127;
        header.writeUIntLE(words, 1, 3);
      }
      return Buffer.concat([header, payload]);
    }
    return this.encodeLong(payload);
  }
  validatePayload(bytes) {
    if (!bytes.byteLength || bytes.byteLength % 4) {
      throw new RangeError('MTProto payload must be aligned to four bytes');
    }
    if (bytes.byteLength > this.maxBytes) {
      throw new RangeError('MTProto frame exceeds byte limit');
    }
  }
  encodeLong(payload) {
    if (this.mode === 'full') {
      const frame = Buffer.alloc(payload.length + 12);
      frame.writeUInt32LE(frame.length);
      frame.writeUInt32LE(this.outgoing++ >>> 0, 4);
      frame.set(payload, 8);
      frame.writeUInt32LE(crc32(frame.subarray(0, -4)), frame.length - 4);
      return frame;
    }
    const padding = this.mode === 'padded' ? this.random(1)[0] % 16 : 0;
    const header = Buffer.alloc(4);
    header.writeUInt32LE(payload.length + padding);
    return Buffer.concat([header, payload, this.random(padding)]);
  }
  push(bytes) {
    if (this.buffer.length + bytes.length > this.maxBytes * 2 + 24) {
      throw new RangeError('MTProto buffered byte limit exceeded');
    }
    this.buffer = Buffer.concat([this.buffer, bytes]);
    const packets = [];
    for (let count = 0; this.buffer.length; count++) {
      if (count >= this.maxPackets) {
        throw new RangeError('MTProto packet limit exceeded');
      }
      const envelope = this.readHeader();
      if (!envelope || this.buffer.length < envelope.total) {
        break;
      }
      const frame = this.buffer.subarray(0, envelope.total);
      this.buffer = this.buffer.subarray(envelope.total);
      if (envelope.ack !== undefined) {
        this.onQuickAck?.(envelope.ack);
        continue;
      }
      const payload = this.decodeFrame(frame, envelope);
      if (payload) {
        packets.push(Buffer.from(payload));
      }
    }
    return packets;
  }
  readHeader() {
    const bytes = this.buffer;
    if (this.mode === 'abridged') {
      if (bytes[0] & 128) {
        return bytes.length < 4
          ? undefined
          : { total: 4, ack: bytes.readUInt32BE() };
      }
      const start = bytes[0] === 127 ? 4 : 1;
      if (bytes.length < start) {
        return;
      }
      const size = (start === 1 ? bytes[0] : bytes.readUIntLE(1, 3)) * 4;
      return this.checkSize(size, start);
    }
    if (bytes.length < 4) {
      return;
    }
    const size = bytes.readUInt32LE();
    if (this.mode === 'intermediate' && size & 0x80000000) {
      return { total: 4, ack: size };
    }
    const start = this.mode === 'full' ? 8 : 4;
    return this.checkSize(this.mode === 'full' ? size - 12 : size, start);
  }
  checkSize(size, start) {
    const extra = this.mode === 'padded' ? 15 : 0;
    if (size < 4 || size > this.maxBytes + extra) {
      throw new RangeError('Invalid MTProto frame size or byte limit');
    }
    if (this.mode !== 'padded' && size % 4) {
      throw new RangeError('Invalid MTProto frame alignment');
    }
    return { start, total: size + start + (this.mode === 'full' ? 4 : 0) };
  }
  decodeFrame(frame, { start }) {
    const end = this.mode === 'full' ? frame.length - 4 : frame.length;
    if (this.mode === 'full') {
      if (crc32(frame.subarray(0, -4)) !== frame.readUInt32LE(end)) {
        throw new Error('Invalid MTProto transport CRC');
      }
      if (frame.readUInt32LE(4) !== this.incoming++ >>> 0) {
        throw new Error('Invalid MTProto transport sequence');
      }
    }
    let payload = frame.subarray(start, end);
    if (this.mode === 'padded') {
      if (payload.length <= 16 && payload.readUInt32LE() === 0xffffffff) {
        if (payload.length < 8) {
          throw new RangeError('Invalid padded quick acknowledgement');
        }
        this.onQuickAck?.(payload.readUInt32LE(4));
        return;
      }
      payload = unpad(payload);
    }
    if (payload.length > this.maxBytes) {
      throw new RangeError('MTProto payload exceeds byte limit');
    }
    if (payload.length === 4 && payload.readInt32LE() < 0) {
      throw new TelegramError('MTProto transport rejected packet', {
        type: 'TRANSPORT_ERROR',
        code: -payload.readInt32LE(),
      });
    }
    return payload;
  }
}

function unpad(bytes) {
  let length;
  if (bytes.length < 20) {
    length = 4;
  } else if (bytes.readBigInt64LE() === 0n) {
    length = 20 + bytes.readInt32LE(16);
  } else {
    length = 24 + Math.floor((bytes.length - 24) / 16) * 16;
  }
  if (length < 4 || length > bytes.length || bytes.length - length > 15) {
    throw new RangeError('Invalid padded MTProto payload length');
  }
  return bytes.subarray(0, length);
}
