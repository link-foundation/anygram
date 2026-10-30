import {
  Anygram,
  BotApi,
  Bot,
  TelegramBot,
  type Context,
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

export async function botContextControls(
  bot: Bot,
  events: TelegramBot,
  ctx: Context,
  signal: AbortSignal
) {
  await bot.api.getMe(signal);
  await bot.api.raw.getMe(signal);
  await bot.api.raw.getUpdates({ timeout: 30 }, signal);
  await bot.api.sendMessage(7, 'text', {}, signal);
  await bot.telegram.sendDocument(7, new InputFile(new Uint8Array([1])), {
    signal,
    timeout: 1000,
  });
  await ctx.reply('text', {}, signal);
  await ctx.editMessageText('edited', { timeout: 1000 }, signal);
  await ctx.answerCallbackQuery('ack', signal);
  await ctx.deleteMessage(signal);
  await ctx.deleteMessage(9, { signal, timeout: 1000 });
  await ctx.replyWithDocument('remote-file', {}, signal);
  await events.getChat(7, { signal, timeout: 1000 });
  await events.deleteMessage(7, 9, signal);
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
