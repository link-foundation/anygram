import {
  Mtproto,
  SecretChatCipher,
  SecretChatCodec,
  SecretChatSequence,
  type SecretChatSequenceState,
} from 'anygram/mtproto';
import type { TlRequest } from 'anygram';

// Requires a separately negotiated chat/key. Persist the snapshot before RPCs;
// after a network failure, recover the outbox with sequence.unacknowledged().
export async function sendSecretText(
  options: {
    client: Mtproto;
    peer: TlRequest;
    sequence: SecretChatSequence;
    cipher: SecretChatCipher;
    save: (state: SecretChatSequenceState) => Promise<void>;
  },
  text: string,
  randomId: bigint
) {
  const frame = options.sequence.create({
    _: 'decryptedMessage',
    random_id: randomId,
    ttl: 0,
    message: text,
  });
  const codec = new SecretChatCodec({ layer: frame.layer });
  const data = options.cipher.encrypt(codec.encode(frame));
  await options.save(options.sequence.exportState());
  return options.client.call('messages.sendEncrypted', {
    peer: options.peer,
    random_id: randomId,
    data,
  });
}
