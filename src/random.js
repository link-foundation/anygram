export function randomId() {
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(8));
  return new DataView(bytes.buffer).getBigInt64(0, true);
}
