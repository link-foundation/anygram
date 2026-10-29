import { SecretChatLifetimes } from '../src/mtproto.js';
import type {
  SecretChatLifetimeMetadata,
  SecretChatLifetimesState,
  SecretChatSessionEffects,
  SecretChatSession,
  SecretChatSessionState,
} from '../src/mtproto.js';
import type { TlRequest } from '../src/index.js';

interface SecretHistoryTransaction {
  loadLifetimes(): Promise<SecretChatLifetimesState>;
  saveLifetimes(state: SecretChatLifetimesState): Promise<void>;
  saveSession(state: SecretChatSessionState): Promise<void>;
  saveMessage(
    message: TlRequest,
    metadata: SecretChatLifetimeMetadata
  ): Promise<void>;
  /** Delete plaintext, thumbnails and cached attachment keys/content together. */
  deleteMessages(ids: bigint[]): Promise<void>;
  clearMessages(): Promise<void>;
}
interface SecretHistoryDatabase {
  loadLifetimes(): Promise<SecretChatLifetimesState>;
  /** Serialize each chat's operations and roll back every write on failure. */
  transaction<T>(run: (tx: SecretHistoryTransaction) => Promise<T>): Promise<T>;
}

/** Use this inside the session's mandatory save callback, before qts advances. */
export function commitSecretHistoryEffects(
  database: SecretHistoryDatabase,
  state: SecretChatSessionState,
  effects: SecretChatSessionEffects,
  at: number,
  metadataFor: (message: TlRequest) => SecretChatLifetimeMetadata
) {
  return database.transaction(async (tx) => {
    const draft = new SecretChatLifetimes({ state: await tx.loadLifetimes() });
    for (const frame of effects.messages) {
      const message = frame.message;
      if (message._ === 'decryptedMessage') {
        const metadata = metadataFor(message);
        draft.track(message, metadata);
        await tx.saveMessage(message, metadata);
      } else if (message._ === 'decryptedMessageService') {
        const action = message.action as TlRequest;
        draft.applyService(action, { at });
        if (action._ === 'decryptedMessageActionDeleteMessages') {
          // Include messages with ttl: 0, which have no lifetime metadata.
          await tx.deleteMessages(action.random_ids as bigint[]);
        } else if (action._ === 'decryptedMessageActionFlushHistory') {
          await tx.clearMessages();
        }
      }
    }
    if (effects.aborted) {
      draft.clear();
      await tx.clearMessages();
    }
    await tx.saveSession(state);
    await tx.saveLifetimes(draft.exportState());
  });
}

/** Serialize per chat. Run at startup and at nextExpiration, then flush outbox. */
export async function deleteExpiredSecretHistory(
  database: SecretHistoryDatabase,
  session: SecretChatSession,
  at: number
): Promise<number | null> {
  const preview = new SecretChatLifetimes({
    state: await database.loadLifetimes(),
  });
  const ids = [...new Set(preview.expire(at).map((entry) => entry.randomId))];
  let next = preview.nextExpiration;
  for (let index = 0; index < ids.length; index += 1000) {
    const batch = ids.slice(index, index + 1000);
    // This also replaces unacknowledged frames and prunes acknowledged packets.
    await session.queueService(
      { _: 'decryptedMessageActionDeleteMessages', random_ids: batch },
      {
        save: (state) =>
          database.transaction(async (tx) => {
            const draft = new SecretChatLifetimes({
              state: await tx.loadLifetimes(),
            });
            draft.remove(batch);
            await tx.deleteMessages(batch);
            await tx.saveSession(state);
            await tx.saveLifetimes(draft.exportState());
            next = draft.nextExpiration;
          }),
      }
    );
  }
  return next;
}

/** UI reads use outgoing: false; opened protected media uses read(ids, ...). */
export function recordSecretHistoryRead(
  database: SecretHistoryDatabase,
  maxDate: number,
  at: number,
  outgoing: boolean
) {
  return database.transaction(async (tx) => {
    const draft = new SecretChatLifetimes({ state: await tx.loadLifetimes() });
    draft.readThrough(maxDate, { outgoing, at });
    await tx.saveLifetimes(draft.exportState());
    return draft.nextExpiration;
  });
}
