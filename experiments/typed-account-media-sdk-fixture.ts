import { TelegramClient as GramClient } from 'telegram';
import { TelegramClient as TeleClient } from 'teleproto';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import {
  Anygram,
  type AccountMessage,
  type AccountAlbumEntry,
} from '../src/index.js';

export async function portableCaption(
  client: Anygram | GramClient | TeleClient
) {
  await client.sendFile('me', {
    file: 'https://example.com/photo.png',
    caption: ['**Ada**', 'Bob'],
    parseMode: 'md',
    replyTo: 7,
  });
}

export async function vendorMedia(
  client: Anygram,
  gram: GramApi.Photo,
  tele: TeleApi.Document
) {
  await client.sendFile('me', {
    file: gram,
    caption: '**Ada**',
    parseMode: 'md',
  });
  const entries: readonly AccountAlbumEntry[] = [
    { file: gram },
    { file: tele, caption: '<b>Bob</b>', parseMode: 'html' },
  ];
  await client.teleproto.sendAlbum('me', entries);
}

export async function portableReply(
  message: AccountMessage | GramApi.Message | TeleApi.Message
) {
  await message.reply({
    file: 'https://example.com/photo.png',
    message: '**Ada**',
    parseMode: 'md',
  });
  await message.edit({
    file: 'https://example.com/photo.png',
    text: '<b>Ada</b>',
    parseMode: 'html',
  });
}
