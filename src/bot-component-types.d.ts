// Public component names and owned official field projections; no SDK implementation.
// Regenerate: node experiments/generate-bot-components.mjs
import type { BotModels } from './bot-types/index.js';
type DateTimeFormat = 'r' | `${'w' | ''}${'d' | 'D' | ''}${'t' | 'T' | ''}`;
interface RichLabelArray extends Array<RichLabel> {}
type RichLabelNode<T> = T extends string
  ? T
  : T extends Array<unknown>
    ? RichLabelArray
    : T extends { type: 'button' }
      ? Omit<T, 'button'> & {
          button:
            | RichMessageButton.UrlButton
            | RichMessageButton.CallbackButton
            | RichMessageButton.WebAppButton
            | RichMessageButton.LoginUrlButton
            | RichMessageButton.SwitchInlineButton
            | RichMessageButton.SwitchInlineCurrentChatButton
            | RichMessageButton.SwitchInlineQueryChosenChatButton
            | RichMessageButton.CopyTextButtonButton
            | RichMessageButton.DisabledButtonButton;
        }
      : T extends { type: 'date_time' }
        ? Omit<T, 'text' | 'date_time_format'> & {
            text: RichLabel;
            date_time_format: DateTimeFormat;
          }
        : T extends { text: unknown }
          ? Omit<T, 'text'> & { text: RichLabel }
          : T;
type RichLabel = RichLabelNode<BotModels['RichText']>;
export type MessageEntity = BotModels['MessageEntity'];
export declare namespace MessageEntity {
  export type AbstractMessageEntity = Pick<
    MessageEntity,
    'offset' | 'length'
  > & { type: string };
  export type CommonMessageEntity = AbstractMessageEntity & {
    type: Exclude<
      MessageEntity['type'],
      'pre' | 'text_link' | 'text_mention' | 'custom_emoji' | 'date_time'
    >;
  };
  export type PreMessageEntity = AbstractMessageEntity & { type: 'pre' } & Pick<
      MessageEntity,
      'language'
    >;
  export type TextLinkMessageEntity = AbstractMessageEntity & {
    type: 'text_link';
  } & Required<Pick<MessageEntity, 'url'>>;
  export type TextMentionMessageEntity = AbstractMessageEntity & {
    type: 'text_mention';
  } & Required<Pick<MessageEntity, 'user'>>;
  export type CustomEmojiMessageEntity = AbstractMessageEntity & {
    type: 'custom_emoji';
  } & Required<Pick<MessageEntity, 'custom_emoji_id'>>;
  export type DateTimeMessageEntity = AbstractMessageEntity & {
    type: 'date_time';
  } & Required<Pick<MessageEntity, 'unix_time' | 'date_time_format'>> & {
      date_time_format: DateTimeFormat;
    };
}
export type InlineKeyboardButton = BotModels['InlineKeyboardButton'];
export declare namespace InlineKeyboardButton {
  export type AbstractInlineKeyboardButton = Pick<
    InlineKeyboardButton,
    'text' | 'icon_custom_emoji_id' | 'style'
  >;
  export type UrlButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'url'>>;
  export type CallbackButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'callback_data'>>;
  export type WebAppButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'web_app'>>;
  export type LoginButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'login_url'>>;
  export type DisabledButtonButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'disabled'>>;
  export type SwitchInlineButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'switch_inline_query'>>;
  export type SwitchInlineCurrentChatButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'switch_inline_query_current_chat'>>;
  export type SwitchInlineChosenChatButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'switch_inline_query_chosen_chat'>>;
  export type CopyTextButtonButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'copy_text'>>;
  export type GameButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'callback_game'>>;
  export type PayButton = AbstractInlineKeyboardButton &
    Required<Pick<InlineKeyboardButton, 'pay'>>;
}
export type KeyboardButton = BotModels['KeyboardButton'];
export declare namespace KeyboardButton {
  export type CommonButton = Pick<
    Exclude<KeyboardButton, string>,
    'text' | 'icon_custom_emoji_id' | 'style'
  >;
  export type RequestUsersButton = CommonButton &
    Required<Pick<Exclude<KeyboardButton, string>, 'request_users'>>;
  export type RequestChatButton = CommonButton &
    Required<Pick<Exclude<KeyboardButton, string>, 'request_chat'>>;
  export type RequestContactButton = CommonButton &
    Required<Pick<Exclude<KeyboardButton, string>, 'request_contact'>>;
  export type RequestLocationButton = CommonButton &
    Required<Pick<Exclude<KeyboardButton, string>, 'request_location'>>;
  export type RequestPollButton = CommonButton &
    Required<Pick<Exclude<KeyboardButton, string>, 'request_poll'>> & {
      request_poll: { type?: 'quiz' | 'regular' };
    };
  export type RequestManagedBotButton = CommonButton &
    Required<Pick<Exclude<KeyboardButton, string>, 'request_managed_bot'>>;
  export type WebAppButton = CommonButton &
    Required<Pick<Exclude<KeyboardButton, string>, 'web_app'>>;
}
export type RichMessageButton = BotModels['RichMessageButton'];
export declare namespace RichMessageButton {
  export type AbstractRichMessageButton = Pick<RichMessageButton, 'style'> & {
    text: RichLabel;
  };
  export type UrlButton = AbstractRichMessageButton &
    Required<Pick<RichMessageButton, 'url'>>;
  export type CallbackButton = AbstractRichMessageButton &
    Required<Pick<RichMessageButton, 'callback_data'>>;
  export type WebAppButton = AbstractRichMessageButton &
    Required<Pick<RichMessageButton, 'web_app'>>;
  export type LoginUrlButton = AbstractRichMessageButton & {
    login_url: Omit<BotModels['LoginUrl'], 'bot_username'>;
  };
  export type SwitchInlineButton = AbstractRichMessageButton &
    Required<Pick<RichMessageButton, 'switch_inline_query'>>;
  export type SwitchInlineCurrentChatButton = AbstractRichMessageButton &
    Required<Pick<RichMessageButton, 'switch_inline_query_current_chat'>>;
  export type SwitchInlineQueryChosenChatButton = AbstractRichMessageButton &
    Required<Pick<RichMessageButton, 'switch_inline_query_chosen_chat'>>;
  export type CopyTextButtonButton = AbstractRichMessageButton &
    Required<Pick<RichMessageButton, 'copy_text'>>;
  export type DisabledButtonButton = AbstractRichMessageButton &
    Required<Pick<RichMessageButton, 'disabled'>>;
}
