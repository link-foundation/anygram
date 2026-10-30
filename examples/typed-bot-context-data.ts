import { Bot, Telegraf } from '../src/index.js';

const bot = new Bot('context:example');
bot.on('business_message', async (ctx) => {
  const connection: string | undefined = ctx.businessConnectionId;
  const messageId: number | undefined = ctx.businessMessage?.message_id;
  await ctx.api.sendMessage(ctx.chatId, `Business message ${messageId}`, {
    business_connection_id: connection,
  });
});
bot.on('message_reaction', (ctx) => {
  const messageId: number | undefined = ctx.msgId;
  const chatId: number | undefined = ctx.messageReaction?.chat.id;
  return { messageId, chatId };
});

const telegraf = new Telegraf('context:example');
telegraf.on('edited_channel_post', (ctx) => {
  const messageId: number | undefined = ctx.editedChannelPost?.message_id;
  const accessible: boolean | undefined = ctx.msg?.isAccessible();
  const caption: boolean | undefined = ctx.msg?.has('caption');
  return { messageId, accessible, caption, inlineId: ctx.inlineMessageId };
});
