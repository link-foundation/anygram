import type { TelegrafContext as Context } from '../src/index.js';

export async function deliveryArguments(ctx: Context) {
  const badKeys = { reply_markup: { inline_keyboard: [['invalid']] } };
  const badParse = { parse_mode: 1 };
  await ctx.replyWithPhoto('photo', { caption: 'caption', has_spoiler: true });
  await ctx.telegram.sendVideo(1, 'video', {
    duration: 3,
    supports_streaming: true,
  });
  await ctx.sendMediaGroup([{ type: 'photo', media: 'photo' }] as const);
  await ctx.replyWithQuiz('Choose', ['yes', 'no'] as const);
  await ctx.replyWithInvoice({
    title: 'Title',
    description: 'Description',
    payload: 'payload',
    currency: 'XTR',
    provider_token: '',
    prices: [{ label: 'Item', amount: 1 }],
  });
  await ctx.reply('hello', { reply_markup: { inline_keyboard: [] } });
  await ctx.editMessageText('edited', { parse_mode: 'HTML' });
  // @ts-expect-error Photo inputs cannot be numbers.
  await ctx.replyWithPhoto(1);
  // @ts-expect-error Photo captions must be strings.
  await ctx.replyWithPhoto('photo', { caption: 1 });
  // @ts-expect-error Video durations are numeric.
  await ctx.telegram.sendVideo(1, 'video', { duration: 'invalid' });
  // @ts-expect-error Media groups require typed media objects.
  await ctx.sendMediaGroup([1]);
  // @ts-expect-error Quiz options require strings or option objects.
  await ctx.replyWithQuiz('Choose', [1]);
  // @ts-expect-error Invoices require their documented fields.
  await ctx.replyWithInvoice({ title: 'Missing fields' });
  // @ts-expect-error Inline keyboard rows must contain button objects.
  await ctx.reply('hello', badKeys);
  // @ts-expect-error Edit options retain documented field types.
  await ctx.editMessageText('edited', { parse_mode: 1 });
  // @ts-expect-error Positional edit options retain documented field types.
  await ctx.telegram.editMessageText(1, 2, undefined, 'x', badParse);
  // @ts-expect-error Video-note inputs cannot be numbers.
  await ctx.replyWithVideoNote(1);
  // @ts-expect-error Telegraf text edits do not accept grammY rich-message blocks.
  await ctx.editMessageText({ blocks: [] });
}
