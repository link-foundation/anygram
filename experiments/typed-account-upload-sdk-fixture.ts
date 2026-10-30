import type { Anygram } from '../src/index.js';
import { TelegramClient as GramClient } from 'telegram';
import { TelegramClient as TeleClient } from 'teleproto';
import { CustomFile } from 'telegram/client/uploads.js';

export async function portableUpload(
  client: Anygram['gramjs'] | Anygram['teleproto'] | GramClient | TeleClient
) {
  const handle = await client.uploadFile({
    file: new CustomFile('note.txt', 3, '', Buffer.from([1, 2, 3])),
    workers: 1,
    maxBufferSize: 32,
    onProgress: (fraction) => console.log(fraction.toFixed(2)),
  });
  console.log(
    handle.id.toString(),
    handle.parts.toFixed(),
    handle.getBytes().byteLength
  );
}
