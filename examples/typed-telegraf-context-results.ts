import type { TelegrafContext as Context } from '../src/index.js';
import type { Telegram } from '../src/index.js';

export async function contextResults(ctx: Context) {
  const sent: Telegram.Message = await ctx.sendMessage('hello');
  const location: Telegram.Message = await ctx.replyWithLocation(1, 2);
  const photo: Telegram.Message = await ctx.replyWithPhoto('photo-id');
  const quiz: Telegram.Message = await ctx.replyWithQuiz('Choose', [
    'yes',
    'no',
  ]);
  const forwarded: Telegram.Message = await ctx.forwardMessage(3);
  const copied: Telegram.MessageId = await ctx.copyMessage(3);
  const copies: Telegram.MessageId[] = await ctx.copyMessages(3, [1, 2]);
  const edited: Pick<Telegram.Message, 'message_id' | 'chat'> | true =
    await ctx.editMessageCaption('edited');
  const poll: Telegram.Poll = await ctx.stopPoll(1);
  const reacted: true = await ctx.react('👍');
  const deleted: true = await ctx.deleteMessages([1, 2]);
  const acknowledged: true = await ctx.answerCbQuery();
  const chat: Telegram.ChatFullInfo = await ctx.getChat();
  const admins: Telegram.ChatMember[] = await ctx.getChatAdministrators();
  const member: Telegram.ChatMember = await ctx.getChatMember(2);
  const left: true = await ctx.leaveChat();
  const topic: Telegram.ForumTopic = await ctx.createForumTopic('thread');
  const closed: true = await ctx.closeForumTopic();
  const stickers: Telegram.StickerSet = await ctx.getStickerSet('stickers');
  const menu: Telegram.MenuButton = await ctx.getChatMenuButton();
  const commands: Telegram.BotCommand[] = await ctx.getMyCommands();
  void [
    sent,
    location,
    photo,
    quiz,
    forwarded,
    copied,
    copies,
    edited,
    poll,
    reacted,
    deleted,
    acknowledged,
    chat,
    admins,
    member,
    left,
    topic,
    closed,
    stickers,
    menu,
    commands,
  ];
  // @ts-expect-error Scoped user identifiers retain their numeric contract.
  await ctx.getChatMember('invalid');
  // @ts-expect-error Sticker models cannot be inferred as a numeric result.
  const invalidSticker: number = await ctx.getStickerSet('stickers');
  void invalidSticker;
}

export async function inferredContextResult(ctx: Context) {
  return (await ctx.getStickerSet('stickers')).name.toUpperCase();
}
