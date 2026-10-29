import {
  uploadEncryptedFile,
  iterDownloadEncryptedFile,
} from '../src/mtproto.js';
import type {
  Mtproto,
  EncryptedFileDownload,
  EncryptedFileUpload,
  SecretChatSession,
  SecretChatSessionSaveOptions,
} from '../src/mtproto.js';

/** Put the key, IV and original size inside the encrypted message media. */
export function encryptSecretAttachment(
  client: Mtproto,
  data: Uint8Array,
  filename: string
): Promise<EncryptedFileUpload> {
  return uploadEncryptedFile(client.call.bind(client), { data, filename });
}

/** Save the exact encrypted request and returned file reference atomically. */
export async function sendDurableSecretAttachment(
  client: Mtproto,
  session: SecretChatSession,
  upload: EncryptedFileUpload,
  randomId: bigint,
  options: SecretChatSessionSaveOptions
) {
  await session.queueFile(
    {
      _: 'decryptedMessage',
      random_id: randomId,
      ttl: 0,
      message: '',
      media: {
        _: 'decryptedMessageMediaDocument',
        thumb: new Uint8Array(),
        thumb_w: 0,
        thumb_h: 0,
        mime_type: 'application/octet-stream',
        size: BigInt(upload.size),
        key: upload.key,
        iv: upload.iv,
        attributes: [
          { _: 'documentAttributeFilename', file_name: upload.name },
        ],
        caption: '',
      },
    },
    upload.file,
    options
  );
  // Persist effects.files together with submitted state in options.save().
  await session.flush(client, options);
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
