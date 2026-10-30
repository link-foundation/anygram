import { parseTelegramLink, type Anygram } from '../src/index.js';

/** Let a caller distinguish join invitations from existing private history. */
export async function openGroup(
  client: Anygram,
  href: string,
  signal?: AbortSignal
): Promise<unknown> {
  const target = parseTelegramLink(href);
  if (target.type === 'invite' || target.type === 'public') {
    // The caller must inspect approval errors and verification-required replies.
    return client.joinChat(href, { signal });
  }
  if (target.type === 'privateMessage') {
    // This succeeds only with a previously obtained access hash.
    const peer = await client.getInputEntity(href, { signal });
    return client.getMessages(peer, { ids: [target.messageId], signal });
  }
  throw new TypeError('A phone link is not a group invitation');
}

/** Inspect an invite and preserve explicit notification flags on a known peer. */
export async function configureInvite(
  client: Anygram,
  hash: string,
  signal?: AbortSignal
): Promise<unknown> {
  const invitation = await client.checkChatInvite(hash, { signal });
  if (invitation._ !== 'chatInviteAlready') {
    return invitation;
  }
  const peer = await client.resolvePeer(invitation.chat, { signal });
  const current = await client.getNotifySettings(peer, { signal });
  if (current.mute_until === 2147483647) {
    return current;
  }
  return client.muteChat(peer, {
    signal,
    showPreviews: false,
    silent: true,
    storiesMuted: true,
    storiesSound: { _: 'notificationSoundNone' },
  });
}
