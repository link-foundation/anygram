import type { Context } from '../src/index.js';
import type { Telegram } from '../src/index.js';

export async function messageSubtypes(ctx: Context) {
  const text: Telegram.Message.TextMessage = await ctx.reply('hello');
  const photo: Telegram.Message.PhotoMessage = await ctx.replyWithPhoto('file');
  const animation: Telegram.Message.AnimationMessage =
    await ctx.replyWithAnimation('file');
  const venue: Telegram.Message.VenueMessage = await ctx.replyWithVenue(
    1,
    2,
    'place',
    'address'
  );
  const poll: Telegram.Message.PollMessage = await ctx.replyWithPoll(
    'question',
    ['one', 'two']
  );
  const rich: Telegram.Message.RichMessageMessage =
    await ctx.replyWithRichMessage({ blocks: [] });
  const rawPhoto: Telegram.Message.PhotoMessage = await ctx.api.raw.sendPhoto({
    chat_id: 1,
    photo: 'file',
  });
  text.text.toUpperCase();
  photo.photo[0].file_id.toUpperCase();
  animation.document.file_id.toUpperCase();
  animation.animation.duration.toFixed();
  venue.location.latitude.toFixed();
  poll.poll.question.toUpperCase();
  rich.rich_message.blocks.length;
  rawPhoto.photo[0].width.toFixed();
  const sent = await ctx.api.sendAudio(1, 'audio');
  sent.audio.duration.toFixed();
  const edited = await ctx.editMessageText('changed');
  if (edited !== true) {
    edited.edit_date.toFixed();
    if ('text' in edited) edited.text.toUpperCase();
    else edited.rich_message.blocks.length;
  }
  const album = await ctx.replyWithMediaGroup([
    { type: 'photo', media: 'file' },
  ]);
  for (const item of album) {
    if ('photo' in item) item.photo[0].width.toFixed();
    else if ('video' in item) item.video.duration.toFixed();
  }
  // @ts-expect-error A photo reply does not promise text.
  const invalid: Telegram.Message.TextMessage = photo;
  void invalid;
  return [text, photo, animation, venue, poll, rich, rawPhoto];
}

export function chatSubtypes(
  chat: Telegram.Chat.PrivateChat,
  group: Telegram.ChatFullInfo.SupergroupChat
) {
  chat.first_name.toUpperCase();
  group.title.toUpperCase();
  // @ts-expect-error Private chats have no title.
  chat.title.toUpperCase();
  return [chat, group];
}

export const privateChat: Telegram.Chat.PrivateChat = {
  id: 1,
  type: 'private',
  first_name: 'Ada',
};
export const groupChat: Telegram.Chat.GroupChat = {
  id: -1,
  type: 'group',
  title: 'Group',
};
// @ts-expect-error Group chats require a title.
export const invalidGroup: Telegram.Chat.GroupChat = { id: -1, type: 'group' };
