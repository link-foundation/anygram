import {
  uploadEncryptedFile,
  iterDownloadEncryptedFile,
} from '../src/mtproto.js';
import type {
  Mtproto,
  EncryptedFileDownload,
  EncryptedFileUpload,
} from '../src/mtproto.js';

/** Put the key, IV and original size inside the encrypted message media. */
export function encryptSecretAttachment(
  client: Mtproto,
  data: Uint8Array,
  filename: string
): Promise<EncryptedFileUpload> {
  return uploadEncryptedFile(client.call.bind(client), { data, filename });
}

/** Obtain file metadata from the update and key material from its secret body. */
export async function saveSecretAttachment(
  client: Mtproto,
  descriptor: EncryptedFileDownload,
  write: (bytes: Uint8Array) => Promise<void>
) {
  for await (const chunk of iterDownloadEncryptedFile(
    client.call.bind(client),
    descriptor
  )) {
    await write(chunk);
  }
}
