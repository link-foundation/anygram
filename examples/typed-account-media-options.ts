import {
  Anygram,
  type AccountMessage,
  type AccountMediaOptions,
  type AccountUploadProgress,
} from '../src/index.js';

export async function sendMedia(
  client: Anygram,
  message: AccountMessage,
  file: unknown,
  thumb: unknown
) {
  const progress: AccountUploadProgress = (fraction) => console.log(fraction);
  progress.isCanceled = false;
  const settings: AccountMediaOptions = {
    thumb,
    supportsStreaming: true,
    spoiler: true,
    ttlSeconds: 0,
    workers: 2,
    partSize: 65536,
    maxBytes: 8 * 1024 * 1024,
    progressCallback: progress,
    onProgress: (uploaded, total) => console.log(uploaded, total),
    attributes: [{ _: 'documentAttributeVideo', duration: 15, w: 640, h: 360 }],
  };
  await client.sendFile('me', { file, ...settings });
  await client.gramjs.sendFile('me', { file, ...settings });
  await client.teleproto.sendAlbum('me', [
    { file, ...settings },
    { file, forceDocument: true },
  ]);
  await message.reply({ file, ...settings });
  await message.edit({ file, ...settings });
  await client.uploadFile(file, settings);
  // @ts-expect-error Media flags require booleans.
  await client.sendFile('me', { file, spoiler: 'yes' });
  // @ts-expect-error Upload worker counts require numbers.
  await client.uploadFile(file, { workers: 'two' });
  await client.sendFile('me', {
    file,
    // @ts-expect-error SDK progress callbacks require a fractional argument.
    progressCallback: (fraction: string) => fraction,
  });
  // @ts-expect-error Replacement edits retain checked metadata.
  await message.edit({ file, ttlSeconds: 'ten' });
  // @ts-expect-error Per-item album MIME types require strings.
  const invalid: AccountMediaOptions = { mimeType: 3 };
  console.log(invalid);
}
