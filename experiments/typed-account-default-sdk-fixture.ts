import { TelegramClient as GramClient } from 'telegram';
import { TelegramClient as TeleClient } from 'teleproto';
import { Anygram } from '../src/index.js';

export async function portableDefault(
  client: Anygram | GramClient | TeleClient
) {
  await client.sendMessage('me', { message: '**Ada**' });
  await client.sendFile('me', {
    file: 'https://example.com/photo.jpg',
    caption: '**Ada**',
  });
  client.setParseMode(undefined);
  await client.sendMessage('me', { message: '**literal**' });
  client.setParseMode('html');
  await client.sendMessage('me', { message: '<b>Ada</b>' });
}
