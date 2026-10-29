import { SecretChatSession } from '../src/mtproto.js';
import type {
  Mtproto,
  SecretChatHandshake,
  SecretChatSessionEffects,
  SecretChatSessionState,
} from '../src/mtproto.js';

interface ChatDatabase {
  /** Encrypt private state at rest and commit effects with it atomically. */
  commit(
    state: SecretChatSessionState,
    effects: SecretChatSessionEffects
  ): Promise<void>;
}

export async function sendDurableSecretMessage(
  client: Mtproto,
  handshake: SecretChatHandshake,
  database: ChatDatabase,
  randomId: bigint,
  message: string
) {
  const session = new SecretChatSession(handshake.credentials());
  const options = {
    save: (state: SecretChatSessionState, effects: SecretChatSessionEffects) =>
      database.commit(state, effects),
  };
  await session.queue(
    { _: 'decryptedMessage', random_id: randomId, ttl: 0, message },
    options
  );
  await session.flush(client, options);
  // Keep the session for subsequent updates/messages; restore its database state
  // after restart. receive() must finish before advancing the account qts cursor.
  return session;
}
