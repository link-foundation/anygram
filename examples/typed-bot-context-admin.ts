import {
  Bot,
  Telegraf,
  type Context,
  type TelegrafContext,
} from '../src/index.js';

async function grammyAdministration(ctx: Context) {
  const signal = new AbortController().signal;
  await ctx.banChatMember(42, { until_date: 100 }, signal);
  await ctx.restrictAuthor({ can_send_messages: false }, { until_date: 100 });
  await ctx.promoteAuthor({ can_manage_chat: true });
  await ctx.setAuthorTag('Member');
  await ctx.getAuthor(signal);
  await ctx.getChatAdministrators({ return_bots: true }, signal);
  await ctx.unpinChatMessage(
    undefined,
    { business_connection_id: 'id' },
    signal
  );
  await ctx.createChatSubscriptionInviteLink(2592000, 1, { name: 'Paid' });
  await ctx.verifyChat({ custom_description: 'Verified' });
  await ctx.editForumTopic({ name: 'Edited' }, signal);
  await ctx.closeForumTopic(signal);
  await ctx.getChatMembersCount(signal);
}

async function telegrafAdministration(ctx: TelegrafContext) {
  const signal = new AbortController().signal;
  await ctx.banChatMember(42, 100, { revoke_messages: true }, signal);
  await ctx.restrictChatMember(42, {
    permissions: { can_send_messages: false },
    until_date: 100,
  });
  await ctx.getChatAdministrators(signal);
  await ctx.unpinChatMessage(undefined, signal);
  await ctx.editForumTopic({ name: 'Edited' }, signal);
  await ctx.closeForumTopic(signal);
  await ctx.getChatMembersCount(signal);
  ctx.assert(ctx.chat, 'example');
}

new Bot('types:fixture').use(grammyAdministration);
new Telegraf('types:fixture').use(telegrafAdministration);
