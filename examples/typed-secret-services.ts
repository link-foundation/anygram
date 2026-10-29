import type {
  Mtproto,
  SecretChatSession,
  SecretChatSessionSaveOptions,
} from '../src/mtproto.js';

/** Persist each service and state before submitting it to the remote peer. */
export async function setSecretLifetime(
  session: SecretChatSession,
  client: Mtproto,
  seconds: number,
  randomId: bigint,
  options: SecretChatSessionSaveOptions
) {
  await session.queueService(
    { _: 'decryptedMessageActionSetMessageTTL', ttl_seconds: seconds },
    options
  );
  // An omitted ttl uses the current default; explicit ttl: 0 disables expiry.
  await session.queue(
    {
      _: 'decryptedMessage',
      random_id: randomId,
      message: 'With the new lifetime',
    },
    options
  );
  await session.flush(client, options);
}

/** Use random IDs for encrypted read/delete/screenshot actions. */
export async function acknowledgeSecretMessages(
  session: SecretChatSession,
  client: Mtproto,
  randomIds: bigint[],
  options: SecretChatSessionSaveOptions
) {
  await session.queueService(
    { _: 'decryptedMessageActionReadMessages', random_ids: randomIds },
    options
  );
  await session.flush(client, options);
}
