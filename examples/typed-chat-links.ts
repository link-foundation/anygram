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
