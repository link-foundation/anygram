import { TelegramClient as GramClient } from 'telegram';
import { TelegramClient as TeleClient } from 'teleproto';
import { Api as GramApi } from 'telegram/tl/index.js';
import { Api as TeleApi } from 'teleproto/tl/index.js';
import bigInt from 'big-integer';
import { Anygram, type AccountMessage } from '../src/index.js';

export async function portableMediaOptions(
  client: Anygram | GramClient | TeleClient
) {
  await client.sendFile('me', {
    file: 'https://example.com/video.mp4',
    forceDocument: true,
    supportsStreaming: true,
    voiceNote: false,
    videoNote: false,
    workers: 2,
    mimeType: 'video/mp4',
    progressCallback: (fraction) => console.log(fraction),
  });
}

export async function portableBoundMedia(
  message: AccountMessage | GramApi.Message | TeleApi.Message
) {
  await message.reply({
    file: 'https://example.com/video.mp4',
    supportsStreaming: true,
    forceDocument: false,
    mimeType: 'video/mp4',
    workers: 2,
  });
  await message.edit({
    file: 'https://example.com/photo.jpg',
    forceDocument: false,
  });
}

export async function currentMediaOptions(client: Anygram | TeleClient) {
  await client.sendFile('me', {
    file: 'https://example.com/video.mp4',
    spoiler: true,
    ttlSeconds: 9,
    nosoundVideo: true,
    videoTimestamp: 2,
    videoCover: new TeleApi.InputPhoto({
      id: bigInt('9007199254740993'),
      accessHash: bigInt('-9007199254740995'),
      fileReference: Buffer.from([1]),
    }),
  });
}
