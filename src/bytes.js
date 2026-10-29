/** Assemble already bounded byte chunks without changing their contents. */
export function joinBytes(chunks, length) {
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

/** Preserve the bit pattern of a signed integer or an unsigned nonce. */
export function fixedIntegerBytes(value, length) {
  if (value instanceof Uint8Array && value.length === length) {
    return value;
  }
  if (typeof value?.toJSNumber === 'function' || value?.__isLong__) {
    value = BigInt(value.toString());
  }
  if (typeof value !== 'bigint') {
    throw new TypeError('Invalid fixed-width TL integer');
  }
  const bits = BigInt(length * 8);
  if (value < -(1n << (bits - 1n)) || value >= 1n << bits) {
    throw new RangeError('Fixed-width TL integer out of range');
  }
  const bytes = new Uint8Array(length);
  for (let index = 0; index < length; index++) {
    bytes[index] = Number((value >> BigInt(index * 8)) & 255n);
  }
  return bytes;
}
