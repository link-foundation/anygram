import {
  Mtproto,
  SecretChatCipher,
  SecretChatCodec,
  SecretChatSequence,
  createSecretChatKeyExchange,
  createSecretChatRequest,
  type SecretChatDhConfig,
  type SecretChatSequenceState,
  type SecretChatHandshakeState,
} from 'anygram/mtproto';
import type { TlRequest } from 'anygram';

// Refresh DH parameters before generating each new initial exchange. Protect
// exchange.exportState() as private key material until negotiation completes.
export function prepareSecretExchange(
  client: Mtproto,
  config?: SecretChatDhConfig
) {
  return createSecretChatKeyExchange(client.call.bind(client), { config });
}

// save must durably commit the protected snapshot before it resolves. Feed
// matching updateEncryption.chat objects to handshake.apply() with the same save.
export async function requestSecretChat(options: {
  client: Mtproto;
  selfId: bigint;
  userId: bigint;
  accessHash: bigint;
  save: (state: SecretChatHandshakeState) => Promise<void>;
}) {
  const invoke = options.client.call.bind(options.client);
  const { handshake } = await createSecretChatRequest(invoke, {
    selfId: options.selfId,
    user: {
      _: 'inputUser',
      user_id: options.userId,
      access_hash: options.accessHash,
    },
  });
  await handshake.submit(invoke, { save: options.save });
  return handshake;
}

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
