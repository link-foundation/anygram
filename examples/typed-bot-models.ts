import type { Telegram, BotMessage, BotUpdate, Context } from '../src/index.js';

export function inspectMessage(message: BotMessage) {
  if (message.photo) {
    const fileId: string = message.photo[0].file_id;
    const width: number = message.photo[0].width;
    void [fileId, width];
  }
  if (message.from) {
    const firstName: string = message.from.first_name;
    const isBot: boolean = message.from.is_bot;
    void [firstName, isBot];
  }
  if (message.reply_to_message?.document) {
    const fileId: string = message.reply_to_message.document.file_id;
    void fileId;
  }
}
export function inspectUpdate(update: BotUpdate, ctx: Context) {
  if (update.callback_query) {
    const sender: number = update.callback_query.from.id;
    void sender;
  }
  if (ctx.from) {
    const name: string = ctx.from.first_name;
    void name;
  }
  if (update.message_reaction) {
    const reaction: Telegram.ReactionType | undefined =
      update.message_reaction.new_reaction[0];
    void reaction;
  }
}
export function inspectMember(member: Telegram.ChatMember) {
  if (member.status === 'administrator') {
    const canDelete: boolean = member.can_delete_messages;
    void canDelete;
  }
}
export function inspectMedia(media: Telegram.InputMedia) {
  if (media.type === 'photo') {
    const caption: string | undefined = media.caption;
    void caption;
    // @ts-expect-error Photo media does not have an audio performer.
    const performer: string = media.performer;
    void performer;
  }
}
export function inspectRichText(text: Telegram.RichText) {
  if (
    typeof text !== 'string' &&
    !Array.isArray(text) &&
    text.type === 'text_mention'
  ) {
    const id: number = text.user.id;
    void id;
  }
}
const update: Telegram.Update = {
  update_id: 1,
  message: {
    message_id: 2,
    date: 1,
    chat: { id: 3, type: 'private' },
    from: { id: 4, is_bot: false, first_name: 'reader' },
    text: 'hello',
  },
};
void update;
// @ts-expect-error Required wire fields must remain required.
const missingId: Telegram.User = { is_bot: false, first_name: 'reader' };
const invalidId: Telegram.User = {
  // @ts-expect-error Telegram identifiers are numeric in Bot API JSON.
  id: '4',
  is_bot: false,
  first_name: 'reader',
};
void [missingId, invalidId];
