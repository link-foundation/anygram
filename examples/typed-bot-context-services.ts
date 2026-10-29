import {
  Bot,
  Telegraf,
  type Context,
  type TelegrafContext,
} from '../src/index.js';

async function grammyServices(ctx: Context) {
  const signal = new AbortController().signal;
  await ctx.getUserProfilePhotos({ limit: 1 }, signal);
  await ctx.getUserProfileAudios({ limit: 1 }, signal);
  await ctx.getUserChatBoosts(undefined, signal);
  await ctx.getManagedBotAccessSettings(signal);
  await ctx.setBusinessAccountName('Name', { last_name: 'Surname' }, signal);
  await ctx.getBusinessAccountGifts({ limit: 1 }, signal);
  await ctx.postStory({ type: 'photo', photo: 'photo:file' }, 86400);
  await ctx.repostStory(86400, { caption: 'Repost' });
  await ctx.getFile(signal);
  await ctx.getCustomEmojiStickers(signal);
  await ctx.replyWithGift('gift:1', { text: 'Gift' });
  await ctx.replyWithChatJoinRequestWebApp('https://example.test/app');
  await ctx.answerPreCheckoutQuery(false, 'Payment declined', signal);
  await ctx.refundStarPayment(signal);
  await ctx.readBusinessMessage(signal);
}

async function telegrafServices(ctx: TelegrafContext) {
  const signal = new AbortController().signal;
  await ctx.answerInlineQuery([], { cache_time: 0 }, signal);
  await ctx.answerCbQuery('Done', { show_alert: true }, signal);
  await ctx.answerGameQuery('https://example.test/game', signal);
  await ctx.getUserChatBoosts(signal);
  await ctx.getStickerSet('stickers', signal);
  await ctx.uploadStickerFile(
    'sticker:file',
    { sticker_format: 'static' },
    signal
  );
  await ctx.setStickerSetThumb('stickers', 8, 'photo:file', signal);
  await ctx.setMyCommands([{ command: 'start', description: 'Start' }]);
  await ctx.setChatMenuButton({ type: 'commands' }, signal);
  await ctx.getChatMenuButton(signal);
}

new Bot('types:fixture').use(grammyServices);
new Telegraf('types:fixture').use(telegrafServices);
