import {
  Bot,
  Telegraf,
  type Context,
  type TelegrafContext,
} from '../src/index.js';

async function grammyActions(ctx: Context) {
  const signal = new AbortController().signal;
  await ctx.editMessageCaption({ caption: 'Caption' }, signal);
  await ctx.editMessageLiveLocation(1.5, 2.5, { heading: 0 }, signal);
  await ctx.editMessageChecklist({ title: 'Tasks', tasks: [] }, {}, signal);
  await ctx.editEphemeralMessageText('Ephemeral', {}, signal);
  await ctx.forwardMessage(-1002, { disable_notification: true }, signal);
  await ctx.copyMessages(-1002, [11, 12], { remove_caption: true }, signal);
  await ctx.react(['😀', { type: 'paid' }], { is_big: true }, signal);
  await ctx.deleteMessageReaction({}, signal);
  await ctx.deleteAllMessageReactions({}, signal);
  await ctx.deleteBusinessMessages([11, 12], signal);
  await ctx.deleteMessage(signal);
  await ctx.deleteMessage(12, signal);
}

async function telegrafActions(ctx: TelegrafContext) {
  const signal = new AbortController().signal;
  await ctx.editMessageCaption('Caption', { parse_mode: 'HTML' }, signal);
  await ctx.editMessageReplyMarkup({ inline_keyboard: [] }, signal);
  await ctx.stopPoll(11, { explanation: 'End' }, signal);
  await ctx.react(['12345', '😀'], true, signal);
  await ctx.copyMessage(-1002, { caption: 'Copy' }, signal);
  await ctx.deleteMessages([11, 12], signal);
  await ctx.persistentChatAction(
    'typing',
    async () => {
      await ctx.reply('Done');
    },
    { intervalDuration: 4000 }
  );
}

new Bot('types:fixture').use(grammyActions);
new Telegraf('types:fixture').use(telegrafActions);
