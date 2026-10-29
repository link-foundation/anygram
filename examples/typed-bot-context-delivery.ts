import {
  Bot,
  Telegraf,
  InputFile,
  type Context,
  type TelegrafContext,
} from '../src/index.js';

async function grammyDelivery(ctx: Context) {
  await ctx.replyWithLivePhoto('video:file', 'photo:file');
  await ctx.replyWithPaidMedia(1, [{ type: 'photo', media: 'photo:file' }]);
  await ctx.sendPaidMedia(1, [{ type: 'photo', media: 'photo:file' }]);
  await ctx.replyWithChecklist({ title: 'Tasks', tasks: [] });
  await ctx.replyWithDraft('partial');
  await ctx.replyWithRichMessageDraft({ blocks: [] });
  await ctx.replyWithRichMessage({ blocks: [] });
  await ctx.replyWithDice();
  await ctx.replyWithDice('🎯', { disable_notification: true });
  await ctx.replyWithInvoice('Order', 'Description', 'order:1', 'USD', []);
  await ctx.replyWithMediaGroup([
    { type: 'photo', media: new InputFile(new Uint8Array([1]), 'photo.jpg') },
  ]);
}

async function telegrafDelivery(ctx: TelegrafContext) {
  await ctx.sendMessage('hello');
  await ctx.sendPhoto('photo:file');
  await ctx.sendMediaGroup([{ type: 'photo', media: 'photo:file' }]);
  await ctx.replyWithInvoice({
    title: 'Order',
    description: 'Description',
    payload: 'order:1',
    currency: 'USD',
    prices: [],
  });
  await ctx.replyWithDice({ emoji: '🎯' });
  await ctx.replyWithQuiz('Question?', ['A', 'B'], { correct_option_id: 0 });
  await ctx.replyWithHTML('<b>hello</b>');
  await ctx.replyWithMarkdownV2('*hello*');
  await ctx.replyWithLocation(1.5, 2.5);
  await ctx.replyWithVenue(1.5, 2.5, 'Venue', 'Address');
  await ctx.replyWithContact('+10000000000', 'Sender');
  await ctx.replyWithChatAction('typing');
  await ctx.replyWithVideoNote('video-note:file');
  await ctx.replyWithGame('game-name');
  const type: string = ctx.updateType;
  void type;
}

new Bot('types:fixture').use(grammyDelivery);
new Telegraf('types:fixture').use(telegrafDelivery);
