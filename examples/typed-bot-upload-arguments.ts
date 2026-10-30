import { Bot, BotApi, InputFile, fmt } from '../src/index.js';
const bot = new Bot('123:example');
const native = new BotApi({ token: '123:example' });
const bytes = new Uint8Array([1, 2, 3]);
const blob = new Blob([bytes]);
export async function uploadArguments() {
  await bot.api.sendPhoto(1, bytes);
  await bot.api.sendPhoto(1, blob);
  await bot.api.sendPhoto(1, new InputFile(bytes));
  await bot.api.sendPhoto(1, { source: bytes, filename: 'photo.jpg' });
  await bot.api.sendPhoto(1, { data: bytes, mimeType: 'image/jpeg' });
  await bot.api.raw.sendPhoto({ chat_id: 1, photo: bytes });
  await bot.api.raw.sendPhoto({ chat_id: 1, photo: blob });
  await bot.api.sendMediaGroup(1, [{ type: 'photo', media: bytes }]);
  await bot.api.sendVideoNote(1, {
    source: '/tmp/video.mp4',
    filename: 'video.mp4',
  });
  await bot.api.sendPoll(1, 'Choose', [
    { text: 'Photo', media: { type: 'photo', media: bytes } },
  ]);
  await native.sendFile(1, { file: bytes, caption: fmt`formatted` });
  await native.editMessage(1, { id: 1, text: 'edited' });
  // @ts-expect-error Native file delivery still requires its file source.
  await native.sendFile(1, {});
  // @ts-expect-error Native edits require their message identifier.
  await native.editMessage(1, { text: 'edited' });
  await bot.api.sendPhoto(1, bytes, {
    caption: fmt`formatted`,
    signal: new AbortController().signal,
  });
  // @ts-expect-error Unsupported numeric upload input.
  await bot.api.sendPhoto(1, 123);
  // @ts-expect-error Data wrappers require bytes or a Blob.
  await bot.api.sendPhoto(1, { data: '/tmp/photo.jpg' });
  // @ts-expect-error Upload wrappers check filename types.
  await bot.api.sendPhoto(1, { source: bytes, filename: 1 });
}
