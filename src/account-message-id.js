export function accountMessageId(message) {
  const id = message && typeof message === 'object' ? message.id : message;
  if (!Number.isSafeInteger(id) || id < 1 || id > 0x7fffffff) {
    throw new RangeError('Message IDs must be positive 32-bit integers');
  }
  return id;
}

const exactPeerId = (id) =>
  typeof id === 'bigint' ||
  (typeof id === 'number' && Number.isSafeInteger(id)) ||
  (typeof id === 'string' && /^-?\d+$/.test(id));

export const samePeerId = (left, right) =>
  exactPeerId(left) && exactPeerId(right) && BigInt(left) === BigInt(right);
