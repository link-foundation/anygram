import { BotApi, InputFile, type InputFileSource } from '../src/index.js';

export async function sendFrames(api: BotApi, chat: bigint) {
  const reusable: InputFileSource = () => new Blob(['a generated frame']);
  await api.callApi('sendDocument', {
    chat_id: chat,
    document: new InputFile(reusable, 'frame.txt'),
  });
}
