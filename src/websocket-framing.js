import { randomBytes } from 'node:crypto';
import { TelegramError } from './errors.js';

export const websocketError = (message, code) =>
  new TelegramError(`WebSocket ${message}`, { type: 'TRANSPORT_ERROR', code });

/** RFC 6455 binary stream framing. Extensions and text messages are not negotiated. */
export class WebSocketFraming {
  constructor({
    client = true,
    maxBytes = 32 * 1024 * 1024,
    maxFrames = 1000,
    random = randomBytes,
  } = {}) {
    if (
      !Number.isSafeInteger(maxBytes) ||
      maxBytes < 1 ||
      maxBytes > 0x3fffffc ||
      !Number.isSafeInteger(maxFrames) ||
      maxFrames < 1
    ) {
      throw new RangeError('Invalid WebSocket byte/frame limit');
    }
    Object.assign(this, { client, maxBytes, maxFrames, random });
    this.buffer = Buffer.alloc(0);
    this.fragmented = false;
    this.messageBytes = 0;
  }
  encode(bytes, { opcode = 2, final = true } = {}) {
    validateFlags(opcode, final, bytes.byteLength);
    if (bytes.byteLength > this.maxBytes) {
      throw new RangeError('WebSocket payload exceeds byte limit');
    }
    const size = bytes.byteLength;
    const prefix = size < 126 ? 2 : size <= 65535 ? 4 : 10;
    const header = Buffer.alloc(prefix + (this.client ? 4 : 0));
    header[0] = (final ? 128 : 0) | opcode;
    header[1] = (this.client ? 128 : 0) | lengthMarker(size);
    if (prefix === 4) {
      header.writeUInt16BE(size, 2);
    }
    if (prefix === 10) {
      header.writeBigUInt64BE(BigInt(size), 2);
    }
    const key = this.client ? Buffer.from(this.random(4)) : undefined;
    if (key) {
      if (key.length !== 4) {
        throw new RangeError('WebSocket mask requires four random bytes');
      }
      header.set(key, prefix);
    }
    return Buffer.concat([header, masked(bytes, key)]);
  }
  push(bytes) {
    if (this.buffer.length + bytes.byteLength > this.maxBytes * 2 + 28) {
      throw new RangeError('WebSocket buffered byte limit exceeded');
    }
    this.buffer = Buffer.concat([this.buffer, bytes]);
    const frames = [];
    while (this.buffer.length) {
      if (frames.length >= this.maxFrames) {
        throw new RangeError('WebSocket frame limit exceeded');
      }
      const header = this.readHeader();
      if (!header || this.buffer.length < header.start + header.length) {
        break;
      }
      const { opcode, final, length, start, mask } = header;
      this.trackMessage(opcode, final, length);
      frames.push({
        opcode,
        final,
        payload: masked(this.buffer.subarray(start, start + length), mask),
      });
      this.buffer = this.buffer.subarray(start + length);
    }
    return frames;
  }
  readHeader() {
    const bytes = this.buffer;
    if (bytes.length < 2) {
      return undefined;
    }
    const opcode = bytes[0] & 15;
    const final = !!(bytes[0] & 128);
    const hasMask = !!(bytes[1] & 128);
    if (bytes[0] & 0x70 || hasMask === this.client) {
      throw websocketError('invalid reserved bits or masking');
    }
    const marker = bytes[1] & 127;
    const prefix = marker < 126 ? 2 : marker === 126 ? 4 : 10;
    if (bytes.length < prefix) {
      return undefined;
    }
    const length = frameLength(bytes, marker);
    validateFlags(opcode, final, length);
    if (length > this.maxBytes) {
      throw new RangeError('WebSocket frame exceeds byte limit');
    }
    const start = prefix + (hasMask ? 4 : 0);
    if (bytes.length < start) {
      return undefined;
    }
    return {
      opcode,
      final,
      length,
      start,
      mask: hasMask ? bytes.subarray(prefix, start) : undefined,
    };
  }
  trackMessage(opcode, final, length) {
    if (opcode >= 8) {
      return;
    }
    if ((opcode === 0) !== this.fragmented) {
      throw websocketError('invalid continuation sequence');
    }
    this.messageBytes += length;
    if (this.messageBytes > this.maxBytes) {
      throw new RangeError('WebSocket message exceeds byte limit');
    }
    this.fragmented = !final;
    if (final) {
      this.messageBytes = 0;
    }
  }
}

function frameLength(bytes, marker) {
  if (marker < 126) {
    return marker;
  }
  const value =
    marker === 126 ? BigInt(bytes.readUInt16BE(2)) : bytes.readBigUInt64BE(2);
  if (
    value > BigInt(Number.MAX_SAFE_INTEGER) ||
    value < (marker === 126 ? 126n : 65536n)
  ) {
    throw websocketError('invalid extended payload length');
  }
  return Number(value);
}

function lengthMarker(size) {
  return size < 126 ? size : size <= 65535 ? 126 : 127;
}

function validateFlags(opcode, final, length) {
  if (
    ![0, 2, 8, 9, 10].includes(opcode) ||
    (opcode >= 8 && (!final || length > 125))
  ) {
    throw websocketError('invalid opcode or control frame');
  }
}

function masked(bytes, key) {
  const copy = Buffer.from(bytes);
  if (key) {
    for (let index = 0; index < copy.length; index++) {
      copy[index] ^= key[index % 4];
    }
  }
  return copy;
}
