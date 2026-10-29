import { Anygram, Api } from '../src/index.js';
import type {
  AccountReactionInput,
  AccountReactionList,
} from '../src/index.js';

export async function reactAndCopy(client: Anygram, signal: AbortSignal) {
  const peer = new Api.InputPeerUser({ userId: 9n, accessHash: 17n });
  const [message] = await client.teleproto.getMessages(peer);
  if (!message) return;
  const custom: AccountReactionInput = new Api.ReactionCustomEmoji({
    documentId: 9007199254740993n,
  });
  await message.react(['👍', custom], true, false, { signal });
  await message.react(undefined, undefined, undefined, { signal });
  const page: AccountReactionList = await message.getReactions(10, '👍', '', {
    signal,
  });
  const copied = await message.copy(peer, {
    silent: true,
    schedule: new Date(123000),
    signal,
  });
  await client.sendReaction(peer, 7, [custom], false, true, { signal });
  await client.gramjs.sendReaction(peer, 7, ['👍'], false, false, { signal });
  const canonicalPage = await client.getReactionUsers(peer, 7, {
    limit: 10,
    offset: '',
    signal,
  });
  const stylePage: AccountReactionList =
    await client.teleproto.getReactionUsers(peer, 7, {
      reaction: '👍',
      signal,
    });
  // @ts-expect-error Reactions cannot be booleans.
  await message.react(true);
  // @ts-expect-error Page limits are numbers.
  await message.getReactions('10');
  // @ts-expect-error Animation flags are booleans.
  await message.react('👍', 'big');
  // @ts-expect-error Results retain optional pagination cursors.
  const requiredCursor: string = page.nextOffset;
  return { page, copied, canonicalPage, stylePage, requiredCursor };
}
