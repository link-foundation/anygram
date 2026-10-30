import {
  Anygram,
  type AccountCollection,
  type AccountMessage,
} from '../src/index.js';

export async function collections(client: Anygram) {
  const messages = await client.gramjs.getMessages('channel', { limit: 1 });
  const typed: AccountCollection<AccountMessage | undefined> = messages;
  const total: number = messages.total;
  const first = typed[0]?.text;
  const dialogs = await client.teleproto.getDialogs({ limit: 0 });
  const dialogTotal: number = dialogs.total;
  // @ts-expect-error A count is a number, even for an empty collection.
  const invalid: string = dialogs.total;
  return { total, first, dialogTotal, invalid };
}
