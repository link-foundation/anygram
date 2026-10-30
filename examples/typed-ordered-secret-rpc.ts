import type { TlRequest } from '../src/index.js';
import type { Mtproto, MtprotoReceipt } from '../src/mtproto.js';

/** Persist these encrypted frames and their sequence state before calling. */
export async function submitSecretFrames(
  client: Mtproto,
  peer: TlRequest,
  frames: readonly {
    randomId: bigint;
    data: Uint8Array;
    service: boolean;
  }[]
) {
  const receipts: MtprotoReceipt<TlRequest>[] = [];
  for (const frame of frames) {
    const previous = receipts.at(-1);
    const receipt = await client.callWithReceipt<TlRequest>(
      frame.service
        ? 'messages.sendEncryptedService'
        : 'messages.sendEncrypted',
      { peer, random_id: frame.randomId, data: frame.data },
      { afterMessageIds: previous ? [previous.messageId] : [] }
    );
    receipts.push(receipt);
  }
  return receipts;
}
