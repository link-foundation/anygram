// Generated portable request/result fixture; run generate-method-type-oracle.mjs.
import type { Context } from 'telegraf';
import type * as Telegram from 'telegraf/types';

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
  const poll: Telegram.Message.PollMessage = await ctx.replyWithQuiz(
    'question',
    ['one', 'two']
  );
  text.text.toUpperCase();
  photo.photo[0].file_id.toUpperCase();
  animation.document.file_id.toUpperCase();
  venue.location.latitude.toFixed();
  poll.poll.question.toUpperCase();
  const edited = await ctx.editMessageText('changed');
  if (edited !== true) {
    edited.edit_date.toFixed();
    edited.text.toUpperCase();
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
  return [text, photo, animation, venue, poll];
}
