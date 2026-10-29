import type { Api as TeleApi } from 'teleproto/tl/index.js';
import type { AccountMessage } from '../src/index.js';
import { Api } from 'teleproto/tl/index.js';
import { returnBigInt } from 'teleproto/Helpers.js';

export async function portableReactions(
  message: AccountMessage | TeleApi.Message
) {
  await message.react('👍', true, false);
  await message.react(
    new Api.ReactionCustomEmoji({
      documentId: returnBigInt('9007199254740993'),
    })
  );
  const page = await message.getReactions(10, '👍', '');
  const cursor: string | undefined = page?.nextOffset;
  const copied = await message.copy(new Api.InputPeerSelf(), { silent: true });
  // @ts-expect-error Neither style accepts boolean reactions.
  await message.react(true);
  // @ts-expect-error Page limits require numbers.
  await message.getReactions('10');
  return { cursor, copied };
}
