import {
  Anygram,
  bold,
  type AccountMessage,
  type AccountFileOptions,
  type AccountAlbumEntry,
} from '../src/index.js';

export async function captions(
  client: Anygram,
  message: AccountMessage,
  file: unknown
) {
  const options: AccountFileOptions = {
    file,
    caption: ['**Ada**', 'unused'],
    parseMode: 'md',
    replyTo: 7,
    formattingEntities: [],
    signal: globalThis.AbortSignal.abort(),
  };
  const entries: readonly AccountAlbumEntry[] = [
    { file, caption: '<b>Ada</b>', parseMode: 'html' },
    { file, caption: bold('Bob'), randomId: 71n },
  ];
  await client.sendFile('me', options);
  await client.gramjs.sendFile('me', options);
  await client.teleproto.sendFile('me', options);
  await client.sendAlbum('me', entries, {
    caption: ['*Ada*', '*Bob*'],
    parseMode: 'md2',
  });
  await client.gramjs.sendAlbum('me', entries);
  await client.teleproto.sendAlbum('me', entries);
  await message.reply({ file, message: '**Ada**', parseMode: 'md' });
  await message.edit({ file, text: '<b>Ada</b>', parseMode: 'html' });
  // @ts-expect-error File captions must be text or FormattedText.
  await client.sendFile('me', { file, caption: 7 });
  // @ts-expect-error Album caption entries must be text or FormattedText.
  await client.sendAlbum('me', entries, { caption: ['Ada', 7] });
  // @ts-expect-error Account parser aliases are checked.
  await client.sendFile('me', { file, parseMode: 'md3' });
  const invalid = [{ _: 'messageEntityBold', offset: '0', length: 3 }];
  // @ts-expect-error File captions retain checked entity spans.
  await client.sendFile('me', { file, entities: invalid });
}
