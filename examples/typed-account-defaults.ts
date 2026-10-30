import { Anygram, MarkdownParser, type AccountMessage } from '../src/index.js';

export async function defaultFormatting(
  client: Anygram,
  message: AccountMessage,
  file: unknown
) {
  // Canonical calls use plain text until a parser is explicitly configured.
  await client.sendMessage('me', '**literal**');
  // Both SDK styles inherit legacy Markdown, including captions and replies.
  await client.gramjs.sendMessage('me', { message: '**Ada**' });
  await client.teleproto.sendFile('me', { file, caption: '**Ada**' });
  await message.reply({ message: '**Ada**', parseMode: null });
  await client.teleproto.sendMessage('me', {
    message: '**literal**',
    parseMode: false,
  });
  // Setting undefined explicitly disables parsing, including copied scopes.
  client.setParseMode(undefined);
  const scoped = client.withBackend('native');
  await scoped.gramjs.sendMessage('me', { message: '**literal**' });
  client.parseMode = MarkdownParser;
  await client.sendMessage('me', '**Ada**');
}
