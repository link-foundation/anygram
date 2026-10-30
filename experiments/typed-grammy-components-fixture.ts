// Generated portable request/result fixture; run generate-method-type-oracle.mjs.
import type * as Telegram from '@grammyjs/types';

export function entityFields(
  common: Telegram.MessageEntity.CommonMessageEntity,
  pre: Telegram.MessageEntity.PreMessageEntity,
  link: Telegram.MessageEntity.TextLinkMessageEntity,
  mention: Telegram.MessageEntity.TextMentionMessageEntity,
  emoji: Telegram.MessageEntity.CustomEmojiMessageEntity,
  date: Telegram.MessageEntity.DateTimeMessageEntity
) {
  pre.language?.toUpperCase();
  link.url.toUpperCase();
  mention.user.id.toFixed();
  emoji.custom_emoji_id.toUpperCase();
  date.unix_time.toFixed();
  date.date_time_format.toUpperCase();
  // @ts-expect-error A common entity has no link URL.
  common.url;
}

export const futureEntity: Telegram.MessageEntity.AbstractMessageEntity = {
  type: 'future_entity',
  offset: 0,
  length: 1,
};
export const formattedDate: Telegram.MessageEntity.DateTimeMessageEntity = {
  type: 'date_time',
  offset: 0,
  length: 1,
  unix_time: 1,
  date_time_format: 'wDt',
};
// @ts-expect-error A text link requires a URL.
export const missingUrl: Telegram.MessageEntity.TextLinkMessageEntity = {
  type: 'text_link',
  offset: 0,
  length: 1,
};
export const invalidDate: Telegram.MessageEntity.DateTimeMessageEntity = {
  type: 'date_time',
  offset: 0,
  length: 1,
  unix_time: 1,
  // @ts-expect-error Named date-time entities use the documented format alphabet.
  date_time_format: 'bad',
};

export const inlineButtons = {
  base: {
    text: 'base',
    icon_custom_emoji_id: 'emoji',
    style: 'primary',
  } satisfies Telegram.InlineKeyboardButton.AbstractInlineKeyboardButton,
  url: {
    text: 'URL',
    url: 'https://example.org',
  } satisfies Telegram.InlineKeyboardButton.UrlButton,
  callback: {
    text: 'Callback',
    callback_data: 'data',
  } satisfies Telegram.InlineKeyboardButton.CallbackButton,
  web: {
    text: 'Web',
    web_app: { url: 'https://example.org' },
  } satisfies Telegram.InlineKeyboardButton.WebAppButton,
  login: {
    text: 'Login',
    login_url: { url: 'https://example.org', bot_username: 'bot' },
  } satisfies Telegram.InlineKeyboardButton.LoginButton,
  disabled: {
    text: 'Disabled',
    disabled: {},
  } satisfies Telegram.InlineKeyboardButton.DisabledButtonButton,
  inline: {
    text: 'Inline',
    switch_inline_query: '',
  } satisfies Telegram.InlineKeyboardButton.SwitchInlineButton,
  current: {
    text: 'Current',
    switch_inline_query_current_chat: '',
  } satisfies Telegram.InlineKeyboardButton.SwitchInlineCurrentChatButton,
  chosen: {
    text: 'Chosen',
    switch_inline_query_chosen_chat: {},
  } satisfies Telegram.InlineKeyboardButton.SwitchInlineChosenChatButton,
  copy: {
    text: 'Copy',
    copy_text: { text: 'copied' },
  } satisfies Telegram.InlineKeyboardButton.CopyTextButtonButton,
  game: {
    text: 'Game',
    callback_game: {},
  } satisfies Telegram.InlineKeyboardButton.GameButton,
  pay: {
    text: 'Pay',
    pay: false,
  } satisfies Telegram.InlineKeyboardButton.PayButton,
};
// @ts-expect-error Callback buttons require callback data.
export const missingCallback: Telegram.InlineKeyboardButton.CallbackButton = {
  text: 'Callback',
};
export const invalidStyle: Telegram.InlineKeyboardButton.AbstractInlineKeyboardButton =
  // @ts-expect-error Styles are a finite Bot API vocabulary.
  { text: 'Base', style: 'link' };

export const keyboardButtons = {
  common: { text: 'Common' } satisfies Telegram.KeyboardButton.CommonButton,
  users: {
    text: 'Users',
    request_users: { request_id: 1 },
  } satisfies Telegram.KeyboardButton.RequestUsersButton,
  chat: {
    text: 'Chat',
    request_chat: { request_id: 1, chat_is_channel: false },
  } satisfies Telegram.KeyboardButton.RequestChatButton,
  contact: {
    text: 'Contact',
    request_contact: false,
  } satisfies Telegram.KeyboardButton.RequestContactButton,
  location: {
    text: 'Location',
    request_location: false,
  } satisfies Telegram.KeyboardButton.RequestLocationButton,
  poll: {
    text: 'Poll',
    request_poll: { type: 'quiz' },
  } satisfies Telegram.KeyboardButton.RequestPollButton,
  managed: {
    text: 'Managed',
    request_managed_bot: { request_id: 1 },
  } satisfies Telegram.KeyboardButton.RequestManagedBotButton,
  web: {
    text: 'Web',
    web_app: { url: 'https://example.org' },
  } satisfies Telegram.KeyboardButton.WebAppButton,
};
export const plainButton: Telegram.KeyboardButton = 'Plain';
export const invalidPoll: Telegram.KeyboardButton.RequestPollButton = {
  text: 'Poll',
  // @ts-expect-error A poll request has a finite type vocabulary.
  request_poll: { type: 'other' },
};

export const richButtons = {
  base: {
    text: 'Base',
    style: 'link',
  } satisfies Telegram.RichMessageButton.AbstractRichMessageButton,
  url: {
    text: 'URL',
    url: 'https://example.org',
  } satisfies Telegram.RichMessageButton.UrlButton,
  callback: {
    text: 'Callback',
    callback_data: 'data',
  } satisfies Telegram.RichMessageButton.CallbackButton,
  web: {
    text: 'Web',
    web_app: { url: 'https://example.org' },
  } satisfies Telegram.RichMessageButton.WebAppButton,
  login: {
    text: 'Login',
    login_url: { url: 'https://example.org', request_write_access: true },
  } satisfies Telegram.RichMessageButton.LoginUrlButton,
  inline: {
    text: 'Inline',
    switch_inline_query: '',
  } satisfies Telegram.RichMessageButton.SwitchInlineButton,
  current: {
    text: 'Current',
    switch_inline_query_current_chat: '',
  } satisfies Telegram.RichMessageButton.SwitchInlineCurrentChatButton,
  chosen: {
    text: 'Chosen',
    switch_inline_query_chosen_chat: {},
  } satisfies Telegram.RichMessageButton.SwitchInlineQueryChosenChatButton,
  copy: {
    text: 'Copy',
    copy_text: { text: 'copied' },
  } satisfies Telegram.RichMessageButton.CopyTextButtonButton,
  disabled: {
    text: 'Disabled',
    disabled: {},
  } satisfies Telegram.RichMessageButton.DisabledButtonButton,
};
export const invalidRichLogin: Telegram.RichMessageButton.LoginUrlButton = {
  text: 'Login',
  // @ts-expect-error Rich login buttons omit the bot username.
  login_url: { url: 'https://example.org', bot_username: 'bot' },
};

export const nestedRichButton: Telegram.RichMessageButton.CallbackButton = {
  text: [
    {
      type: 'bold',
      text: {
        type: 'button',
        button: { text: 'Nested', callback_data: 'nested' },
      },
    },
  ],
  callback_data: 'outer',
};
export const invalidNestedDate: Telegram.RichMessageButton.CallbackButton = {
  // @ts-expect-error Nested rich labels retain the documented date format.
  text: {
    type: 'date_time',
    text: 'Date',
    unix_time: 1,
    date_time_format: 'bad',
  },
  callback_data: 'outer',
};
export const invalidNestedButton: Telegram.RichMessageButton.CallbackButton = {
  // @ts-expect-error A nested rich button also requires an action.
  text: { type: 'button', button: { text: 'No action' } },
  callback_data: 'outer',
};
