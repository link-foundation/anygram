// Generated portable request/result fixture; run generate-method-type-oracle.mjs.
import type { Context } from 'grammy';
import type * as Telegram from '@grammyjs/types';

export async function contextResults(ctx: Context) {
  const location: Telegram.Message = await ctx.replyWithLocation(1, 2);
  const photo: Telegram.Message = await ctx.replyWithPhoto('photo-id');
  const dice: Telegram.Message = await ctx.replyWithDice('🎲');
  const action: true = await ctx.replyWithChatAction('typing');
  const forwarded: Telegram.Message = await ctx.forwardMessage(3);
  const copied: Telegram.MessageId = await ctx.copyMessage(3);
  const copies: Telegram.MessageId[] = await ctx.copyMessages(3, [1, 2]);
  const edited: Pick<Telegram.Message, 'message_id' | 'chat'> | true =
    await ctx.editMessageCaption({ caption: 'edited' });
  const poll: Telegram.Poll = await ctx.stopPoll();
  const reacted: true = await ctx.react('👍');
  const deleted: true = await ctx.deleteMessage();
  const acknowledged: true = await ctx.answerCallbackQuery();
  const chat: Telegram.ChatFullInfo = await ctx.getChat();
  const admins: Telegram.ChatMember[] = await ctx.getChatAdministrators();
  const member: Telegram.ChatMember = await ctx.getAuthor();
  const left: true = await ctx.leaveChat();
  const topic: Telegram.ForumTopic = await ctx.createForumTopic('thread');
  const closed: true = await ctx.closeForumTopic();
  const file: Telegram.File = await ctx.getFile();
  const photos: Telegram.UserProfilePhotos = await ctx.getUserProfilePhotos();
  const gifts: Telegram.OwnedGifts = await ctx.getUserGifts();
  const menu: Telegram.MenuButton = await ctx.getChatMenuButton();
  const boosts: Telegram.UserChatBoosts = await ctx.getUserChatBoosts();
  const business: Telegram.BusinessConnection =
    await ctx.getBusinessConnection();
  const gift: true = await ctx.replyWithGift('gift');
  const checkout: true = await ctx.answerPreCheckoutQuery(true);
  void [
    location,
    photo,
    dice,
    action,
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
    file,
    photos,
    gifts,
    menu,
    boosts,
    business,
    gift,
    checkout,
  ];
  // @ts-expect-error Scoped user identifiers retain their numeric contract.
  await ctx.getChatMember('invalid');
  // @ts-expect-error A file result cannot be inferred from assignment context.
  const invalidFile: number = await ctx.getFile();
  void invalidFile;
}

export async function inferredContextResult(ctx: Context) {
  return (await ctx.getFile()).file_id.toUpperCase();
}
