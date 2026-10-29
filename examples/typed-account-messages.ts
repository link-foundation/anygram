import { Api, bold } from '../src/index.js';
import type { Anygram } from '../src/index.js';

/** Choose the style whose defaults the migrated account application expects. */
export async function replyAndRead(client: Anygram, peer: unknown) {
  const [message] = await client.teleproto.getMessages(peer, { limit: 1 });
  if (!message) return;
  const original = await message.getReplyMessage();
  const sent = await message.reply({ message: bold('Received'), silent: true });
  await message.markAsRead();
  return { original: original?.rawText, sent: sent?.id, chat: message.chatId };
}

export async function inspectAndEdit(client: Anygram, peer: unknown) {
  for await (const message of client.gramjs.iterMessages(peer, { limit: 10 })) {
    const words = message.getEntitiesText(Api.MessageEntityBold);
    const metadata = message.file && {
      name: message.file.name,
      size: message.file.size,
      duration: message.file.duration,
    };
    await message.edit({ text: message.rawText, linkPreview: false });
    return { words, metadata };
  }
}

/** Explicit deletion flags keep cross-style behavior visible during migration. */
export async function deleteLast(client: Anygram, peer: unknown) {
  const [message] = await client.gramjs.getMessages(peer, { limit: 1 });
  return message?.delete({ revoke: false });
}

export async function replyWithEntities(client: Anygram, peer: unknown) {
  const [message] = await client.gramjs.getMessages(peer, { limit: 1 });
  return message?.reply({
    message: 'BoldURL',
    formattingEntities: [
      new Api.MessageEntityBold({ offset: 0, length: 4 }),
      {
        _: 'messageEntityTextUrl',
        offset: 4,
        length: 3,
        url: 'https://example.com',
      },
    ],
  });
}

export async function checkAccountMessageArguments(client: Anygram) {
  const [message] = await client.gramjs.getMessages('me', { limit: 1 });
  if (!message) return;
  // @ts-expect-error Replies require text or explicit FormattedText.
  await message.reply({ message: 42 });
  // @ts-expect-error Edit text cannot be a number.
  await message.edit({ text: 42 });
  // @ts-expect-error Revoke must be boolean.
  await message.delete({ revoke: 'false' });
  // @ts-expect-error Pin notification options must be boolean.
  await message.pin({ notify: 'true' });
  // @ts-expect-error Formatting entities need their TL kind.
  await message.reply({ formattingEntities: [{ offset: 0, length: 1 }] });
}
