import {
  Anygram,
  BotApi,
  InputFile,
  type InputFileSource,
} from '../src/index.js';
import { uploadEncryptedFile, type SecretChatInvoke } from '../src/mtproto.js';

export async function sendFrames(api: BotApi, chat: bigint) {
  const reusable: InputFileSource = () => new Blob(['a generated frame']);
  await api.callApi('sendDocument', {
    chat_id: chat,
    document: new InputFile(reusable, 'frame.txt'),
  });
}

export async function botOperations(
  client: Anygram,
  api: BotApi,
  signal: AbortSignal
) {
  await client.getMe({ signal, timeout: 1000 });
  await client.deleteMessages(7n, [2, 3], { signal, timeout: 1000 });
  await api.deleteMessages(7n, [2, 3], { signal });
}

export async function uploadAccountFiles(
  client: Anygram,
  invoke: SecretChatInvoke
) {
  const reusable = new InputFile(
    () => [new Uint8Array([1, 2, 3])],
    'shared.bin'
  );
  await client.uploadFile(reusable, {
    maxBytes: 1024,
    partSize: 1024,
    maxParts: 1,
  });
  await uploadEncryptedFile(invoke, reusable, { maxBytes: 1024 });
}
