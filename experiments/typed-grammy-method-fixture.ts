// Generated portable request/result fixture; run generate-method-type-oracle.mjs.
import { Bot, InputFile } from 'grammy';
import type * as Telegram from '@grammyjs/types';

const bot = new Bot('123:example');
export async function requests() {
  const me: Telegram.User = await bot.api.getMe();
  const chat: Telegram.ChatFullInfo = await bot.api.getChat('@example');
  const admins: Telegram.ChatMember[] = await bot.api.getChatAdministrators(1);
  const member: Telegram.ChatMember = await bot.api.getChatMember(1, 2);
  const count: number = await bot.api.getChatMemberCount(1);
  const invite: string = await bot.api.exportChatInviteLink(1);
  const left: true = await bot.api.leaveChat(1);
  const file: Telegram.File = await bot.api.getFile('file-id');
  const updates: Telegram.Update[] = await bot.api.getUpdates({ limit: 5 });
  const commands: Telegram.BotCommand[] = await bot.api.getMyCommands();
  const name: Telegram.BotName = await bot.api.getMyName({
    language_code: 'en',
  });
  const sent: Telegram.Message = await bot.api.sendMessage(1, 'hello');
  const photo: Telegram.Message = await bot.api.sendPhoto(
    1,
    new InputFile(new Uint8Array([1]), 'photo.png'),
    { caption: 'photo' }
  );
  const rawMe: Telegram.User = await bot.api.raw.getMe();
  const rawChat: Telegram.ChatFullInfo = await bot.api.raw.getChat({
    chat_id: 1,
  });
  const rawSent: Telegram.Message = await bot.api.raw.sendMessage({
    chat_id: 1,
    text: 'hello',
  });
  void [
    me,
    chat,
    admins,
    member,
    count,
    invite,
    left,
    file,
    updates,
    commands,
    name,
    sent,
    photo,
    rawMe,
    rawChat,
    rawSent,
  ];
}
// @ts-expect-error Chat identifiers are strings or numbers.
bot.api.getChat(false);
// @ts-expect-error User identifiers are numbers.
bot.api.getChatMember(1, 'user');
// @ts-expect-error API options retain their actual field types.
bot.api.getUpdates({ limit: 'five' });
// @ts-expect-error Required raw arguments cannot be omitted.
bot.api.raw.getChat();
// @ts-expect-error Raw methods reject misspelled fields.
bot.api.raw.sendMessage({ chat_id: 1, txet: 'hello' });
// @ts-expect-error Raw methods check argument field types.
bot.api.raw.sendMessage({ chat_id: 1, text: false });

export async function inferredResponse() {
  return (await bot.api.raw.getMe()).first_name.toUpperCase();
}
