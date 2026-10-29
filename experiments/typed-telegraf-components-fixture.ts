// Generated portable request/result fixture; run generate-method-type-oracle.mjs.
import type * as Telegram from 'telegraf/types';

export function componentFields(
  link: Telegram.MessageEntity.TextLinkMessageEntity,
  mention: Telegram.MessageEntity.TextMentionMessageEntity,
  emoji: Telegram.MessageEntity.CustomEmojiMessageEntity,
  callback: Telegram.InlineKeyboardButton.CallbackButton,
  web: Telegram.InlineKeyboardButton.WebAppButton,
  poll: Telegram.KeyboardButton.RequestPollButton
) {
  link.url.toUpperCase();
  mention.user.id.toFixed();
  emoji.custom_emoji_id.toUpperCase();
  callback.callback_data.toUpperCase();
  web.web_app.url.toUpperCase();
  poll.request_poll.type?.toUpperCase();
  // @ts-expect-error A callback button does not promise a URL.
  callback.url;
}
export const pollButton: Telegram.KeyboardButton.RequestPollButton = {
  text: 'Poll',
  request_poll: { type: 'quiz' },
};
export const payButton: Telegram.InlineKeyboardButton.PayButton = {
  text: 'Pay',
  pay: false,
};
// @ts-expect-error A callback button requires its payload.
export const missingPayload: Telegram.InlineKeyboardButton.CallbackButton = {
  text: 'Callback',
};
// @ts-expect-error A text link entity requires its URL.
export const missingLink: Telegram.MessageEntity.TextLinkMessageEntity = {
  type: 'text_link',
  offset: 0,
  length: 1,
};
