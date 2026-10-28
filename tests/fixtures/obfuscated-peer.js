import { createCipheriv, createDecipheriv, createHash } from 'node:crypto';

/** Server-side oracle from the published wire format, independent of the client. */
export function peerFor(header, key) {
  const derive = (bytes) =>
    key
      ? createHash('sha256')
          .update(Buffer.concat([bytes, key]))
          .digest()
      : bytes;
  const reversed = Buffer.from(header.subarray(8, 56)).reverse();
  const incoming = createDecipheriv(
    'aes-256-ctr',
    derive(header.subarray(8, 40)),
    header.subarray(40, 56)
  );
  const outgoing = createCipheriv(
    'aes-256-ctr',
    derive(reversed.subarray(0, 32)),
    reversed.subarray(32)
  );
  const decoded = incoming.update(header);
  return {
    incoming,
    outgoing,
    plain: Buffer.concat([header.subarray(0, 56), decoded.subarray(56)]),
  };
}
