import { Api, CustomFile, InputFile, type Anygram } from '../src/index.js';

export async function upload(client: Anygram, bytes: Uint8Array) {
  const file = new CustomFile('note.txt', bytes.length, '', bytes);
  const handle = await client.gramjs.uploadFile({
    file,
    workers: 2,
    fileSize: bytes.length,
    maxBufferSize: 0,
    onProgress: (fraction) => console.log(fraction.toFixed(2)),
  });
  if (handle instanceof Api.InputFile) {
    console.log(handle.md5Checksum.toUpperCase(), handle.getBytes());
  }
  await client.teleproto.sendFile('me', { file: handle });
  await client.uploadFile({
    file,
    onProgress: (fraction) => console.log(fraction.toFixed(2)),
  });
  await client.uploadFile(new InputFile(bytes, 'raw.txt'), {
    onProgress: (uploaded, total) => console.log(uploaded / total),
  });
}

export async function checkUploadTypes(client: Anygram, file: CustomFile) {
  await client.teleproto.uploadFile({
    file,
    // @ts-expect-error Direct SDK uploads report one fractional argument.
    onProgress: (n: number, total: number) => n / total,
  });
  // @ts-expect-error Worker counts retain their numeric type.
  await client.gramjs.uploadFile({ file, workers: '2' });
  // @ts-expect-error Size hints retain their numeric type.
  await client.gramjs.uploadFile({ file, fileSize: '3' });
}
