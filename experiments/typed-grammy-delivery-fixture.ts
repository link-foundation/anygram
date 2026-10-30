// Generated portable request/result fixture; run generate-method-type-oracle.mjs.
import type { Context } from 'grammy';

export async function deliveryArguments(ctx: Context) {
  const badPrices = [{ label: 'Item', amount: 'invalid' }];
  const badKeys = { reply_markup: { inline_keyboard: [['invalid']] } };
  const badPreview = { link_preview_options: { is_disabled: 'invalid' } };
  await ctx.replyWithPhoto('photo', { caption: 'caption', has_spoiler: true });
  await ctx.api.sendVideo(1, 'video', {
    duration: 3,
    supports_streaming: true,
  });
  await ctx.replyWithMediaGroup([{ type: 'photo', media: 'photo' }] as const);
  await ctx.replyWithPoll('Choose', ['yes', { text: 'no' }] as const);
  await ctx.replyWithInvoice('Title', 'Description', 'payload', 'XTR', [
    { label: 'Item', amount: 1 },
  ]);
  await ctx.reply('hello', { reply_markup: { inline_keyboard: [] } });
  await ctx.editMessageText('edited', {
    link_preview_options: { is_disabled: true },
  });
  // @ts-expect-error Photos require a file ID, URL or supported upload input.
  await ctx.replyWithPhoto(1);
  // @ts-expect-error Photo captions must be strings.
  await ctx.replyWithPhoto('photo', { caption: 1 });
  // @ts-expect-error Video durations are numeric.
  await ctx.api.sendVideo(1, 'video', { duration: 'invalid' });
  // @ts-expect-error Media groups require typed media objects.
  await ctx.replyWithMediaGroup([1]);
  // @ts-expect-error Poll options require strings or option objects.
  await ctx.replyWithPoll('Choose', [1]);
  // @ts-expect-error Invoice prices have numeric amounts.
  await ctx.replyWithInvoice('T', 'D', 'p', 'XTR', badPrices);
  // @ts-expect-error Inline keyboard rows must contain button objects.
  await ctx.reply('hello', badKeys);
  // @ts-expect-error Edit options retain their documented nested field types.
  await ctx.editMessageText('edited', badPreview);
  // @ts-expect-error Positional edit options retain their documented field types.
  await ctx.api.editMessageText(1, 2, 'edited', { parse_mode: 1 });
  // @ts-expect-error Video-note inputs cannot be numbers.
  await ctx.replyWithVideoNote(1);
  // @ts-expect-error Location live periods must be numbers.
  await ctx.replyWithLocation(1, 2, { live_period: 'invalid' });
}
