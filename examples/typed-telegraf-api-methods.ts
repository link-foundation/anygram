import { Telegraf } from '../src/index.js';
import type { Telegram } from '../src/index.js';
const bot = new Telegraf('123:example');
export async function telegramRequests() {
  const chat: Telegram.ChatFullInfo = await bot.telegram.getChat(1);
  const member: Telegram.ChatMember = await bot.telegram.getChatMember(1, 2);
  const count: number = await bot.telegram.getChatMembersCount(1);
  const file: Telegram.File = await bot.telegram.getFile('file');
  const invite: string = await bot.telegram.exportChatInviteLink(1);
  const left: true = await bot.telegram.leaveChat(1);
  const menu: Telegram.MenuButton = await bot.telegram.getChatMenuButton({
    chatId: 1,
  });
  const commands: Telegram.BotCommand[] = await bot.telegram.getMyCommands();
  const sent: Telegram.Message = await bot.telegram.sendPoll(1, 'Choose', [
    'yes',
    'no',
  ]);
  const edited: Pick<Telegram.Message, 'message_id' | 'chat'> | true =
    await bot.telegram.editMessageCaption(
      undefined,
      undefined,
      'inline',
      'caption'
    );
  void [chat, member, count, file, invite, left, menu, commands, sent, edited];
}
// @ts-expect-error Chat identifiers are strings or numbers.
bot.telegram.getChat(false);
// @ts-expect-error Positional user identifiers are integers.
bot.telegram.getChatMember(1, 'user');
// @ts-expect-error Camel-case menu input retains its field types.
bot.telegram.setChatMenuButton({ chatId: false });
// @ts-expect-error API extras retain their field types.
bot.telegram.sendPoll(1, 'Choose', ['yes'], { is_anonymous: 'yes' });
