import { SecretChatRekey } from '../src/mtproto.js';
import type {
  SecretChatRekeyResult,
  SecretChatRekeyState,
} from '../src/mtproto.js';
import type { TlRequest } from '../src/index.js';

/** Prepare an ordered service action without changing the committed snapshot. */
export function planSecretRekey(
  state: SecretChatRekeyState,
  action: TlRequest
): { state: SecretChatRekeyState; effects: SecretChatRekeyResult } {
  const draft = new SecretChatRekey({ state });
  try {
    const effects = draft.receive(action);
    // Commit this snapshot, key changes and sequence/outbox effects atomically.
    // Initiator commits use the old key; recipient noops use the installed key.
    // Protect both private state and any returned key material.
    return { state: draft.exportState(), effects };
  } finally {
    draft.destroy();
  }
}
