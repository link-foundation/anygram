import {
  SecretChatKeyRing,
  type SecretChatKeyRingState,
} from 'anygram/mtproto';

/** Plan on a protected draft; save key, sequence and outbox changes together. */
export function observeAccepted(
  state: SecretChatKeyRingState,
  fingerprint: bigint,
  counter: number,
  nextIncoming: number
): SecretChatKeyRingState {
  const draft = new SecretChatKeyRing({ state });
  try {
    draft.observe(fingerprint, counter);
    draft.retire(nextIncoming);
    return draft.exportState();
  } finally {
    draft.destroy();
  }
}
