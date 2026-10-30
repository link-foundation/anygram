import type { Anygram } from '../src/index.js';
import type { TelegramClient as GramClient } from 'telegram';
import type { TelegramClient as TeleClient } from 'teleproto';

export async function portableCollections(
  client: Anygram['gramjs'] | GramClient | TeleClient
) {
  const messages = await client.getMessages('channel', { limit: 1 });
  const messageCount: number | undefined = messages.total;
  const dialogs = await client.getDialogs({ limit: 1 });
  const dialogCount: number | undefined = dialogs.total;
  const firstName: string | undefined = dialogs[0]?.name;
  // @ts-expect-error Counts cannot be assigned to strings.
  const invalid: string = messages.total;
  return { messageCount, dialogCount, firstName, invalid };
}
