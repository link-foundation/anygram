// Actual SDK component comparisons; regenerate with generate-bot-component-oracle.mjs.
import type * as Original from '@grammyjs/types';
import type { Telegram } from '../src/index.js';
type Assert<T extends true> = T;
type Equal<A, B> = [A, B] extends [B, A] ? true : false;
type Accepts<Expected, Actual> = [Actual] extends [Expected] ? true : false;
type RequiredKeys<T> = {
  [K in keyof T]-?: object extends Pick<T, K> ? never : K;
}[keyof T];
export interface ComponentSubtypeOracle {
  MessageEntityAbstractMessageEntity: Assert<
    Equal<
      keyof Telegram.MessageEntity.AbstractMessageEntity,
      keyof Original.MessageEntity.AbstractMessageEntity
    >
  >;
  MessageEntityAbstractMessageEntityRequired: Assert<
    Equal<
      RequiredKeys<Telegram.MessageEntity.AbstractMessageEntity>,
      RequiredKeys<Original.MessageEntity.AbstractMessageEntity>
    >
  >;
  MessageEntityAbstractMessageEntitySdk: Assert<
    Accepts<
      Telegram.MessageEntity.AbstractMessageEntity,
      Original.MessageEntity.AbstractMessageEntity
    >
  >;
  MessageEntityAbstractMessageEntityOwned: Assert<
    Accepts<
      Original.MessageEntity.AbstractMessageEntity,
      Telegram.MessageEntity.AbstractMessageEntity
    >
  >;
  MessageEntityCommonMessageEntity: Assert<
    Equal<
      keyof Telegram.MessageEntity.CommonMessageEntity,
      keyof Original.MessageEntity.CommonMessageEntity
    >
  >;
  MessageEntityCommonMessageEntityRequired: Assert<
    Equal<
      RequiredKeys<Telegram.MessageEntity.CommonMessageEntity>,
      RequiredKeys<Original.MessageEntity.CommonMessageEntity>
    >
  >;
  MessageEntityCommonMessageEntitySdk: Assert<
    Accepts<
      Telegram.MessageEntity.CommonMessageEntity,
      Original.MessageEntity.CommonMessageEntity
    >
  >;
  MessageEntityCommonMessageEntityOwned: Assert<
    Accepts<
      Original.MessageEntity.CommonMessageEntity,
      Telegram.MessageEntity.CommonMessageEntity
    >
  >;
  MessageEntityPreMessageEntity: Assert<
    Equal<
      keyof Telegram.MessageEntity.PreMessageEntity,
      keyof Original.MessageEntity.PreMessageEntity
    >
  >;
  MessageEntityPreMessageEntityRequired: Assert<
    Equal<
      RequiredKeys<Telegram.MessageEntity.PreMessageEntity>,
      RequiredKeys<Original.MessageEntity.PreMessageEntity>
    >
  >;
  MessageEntityPreMessageEntitySdk: Assert<
    Accepts<
      Telegram.MessageEntity.PreMessageEntity,
      Original.MessageEntity.PreMessageEntity
    >
  >;
  MessageEntityPreMessageEntityOwned: Assert<
    Accepts<
      Original.MessageEntity.PreMessageEntity,
      Telegram.MessageEntity.PreMessageEntity
    >
  >;
  MessageEntityTextLinkMessageEntity: Assert<
    Equal<
      keyof Telegram.MessageEntity.TextLinkMessageEntity,
      keyof Original.MessageEntity.TextLinkMessageEntity
    >
  >;
  MessageEntityTextLinkMessageEntityRequired: Assert<
    Equal<
      RequiredKeys<Telegram.MessageEntity.TextLinkMessageEntity>,
      RequiredKeys<Original.MessageEntity.TextLinkMessageEntity>
    >
  >;
  MessageEntityTextLinkMessageEntitySdk: Assert<
    Accepts<
      Telegram.MessageEntity.TextLinkMessageEntity,
      Original.MessageEntity.TextLinkMessageEntity
    >
  >;
  MessageEntityTextLinkMessageEntityOwned: Assert<
    Accepts<
      Original.MessageEntity.TextLinkMessageEntity,
      Telegram.MessageEntity.TextLinkMessageEntity
    >
  >;
  MessageEntityTextMentionMessageEntity: Assert<
    Equal<
      keyof Telegram.MessageEntity.TextMentionMessageEntity,
      keyof Original.MessageEntity.TextMentionMessageEntity
    >
  >;
  MessageEntityTextMentionMessageEntityRequired: Assert<
    Equal<
      RequiredKeys<Telegram.MessageEntity.TextMentionMessageEntity>,
      RequiredKeys<Original.MessageEntity.TextMentionMessageEntity>
    >
  >;
  MessageEntityTextMentionMessageEntitySdk: Assert<
    Accepts<
      Telegram.MessageEntity.TextMentionMessageEntity,
      Original.MessageEntity.TextMentionMessageEntity
    >
  >;
  MessageEntityTextMentionMessageEntityOwned: Assert<
    Accepts<
      Original.MessageEntity.TextMentionMessageEntity,
      Telegram.MessageEntity.TextMentionMessageEntity
    >
  >;
  MessageEntityCustomEmojiMessageEntity: Assert<
    Equal<
      keyof Telegram.MessageEntity.CustomEmojiMessageEntity,
      keyof Original.MessageEntity.CustomEmojiMessageEntity
    >
  >;
  MessageEntityCustomEmojiMessageEntityRequired: Assert<
    Equal<
      RequiredKeys<Telegram.MessageEntity.CustomEmojiMessageEntity>,
      RequiredKeys<Original.MessageEntity.CustomEmojiMessageEntity>
    >
  >;
  MessageEntityCustomEmojiMessageEntitySdk: Assert<
    Accepts<
      Telegram.MessageEntity.CustomEmojiMessageEntity,
      Original.MessageEntity.CustomEmojiMessageEntity
    >
  >;
  MessageEntityCustomEmojiMessageEntityOwned: Assert<
    Accepts<
      Original.MessageEntity.CustomEmojiMessageEntity,
      Telegram.MessageEntity.CustomEmojiMessageEntity
    >
  >;
  MessageEntityDateTimeMessageEntity: Assert<
    Equal<
      keyof Telegram.MessageEntity.DateTimeMessageEntity,
      keyof Original.MessageEntity.DateTimeMessageEntity
    >
  >;
  MessageEntityDateTimeMessageEntityRequired: Assert<
    Equal<
      RequiredKeys<Telegram.MessageEntity.DateTimeMessageEntity>,
      RequiredKeys<Original.MessageEntity.DateTimeMessageEntity>
    >
  >;
  MessageEntityDateTimeMessageEntitySdk: Assert<
    Accepts<
      Telegram.MessageEntity.DateTimeMessageEntity,
      Original.MessageEntity.DateTimeMessageEntity
    >
  >;
  MessageEntityDateTimeMessageEntityOwned: Assert<
    Accepts<
      Original.MessageEntity.DateTimeMessageEntity,
      Telegram.MessageEntity.DateTimeMessageEntity
    >
  >;
  InlineKeyboardButtonAbstractInlineKeyboardButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.AbstractInlineKeyboardButton,
      keyof Original.InlineKeyboardButton.AbstractInlineKeyboardButton
    >
  >;
  InlineKeyboardButtonAbstractInlineKeyboardButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.AbstractInlineKeyboardButton>,
      RequiredKeys<Original.InlineKeyboardButton.AbstractInlineKeyboardButton>
    >
  >;
  InlineKeyboardButtonAbstractInlineKeyboardButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.AbstractInlineKeyboardButton,
      Original.InlineKeyboardButton.AbstractInlineKeyboardButton
    >
  >;
  InlineKeyboardButtonAbstractInlineKeyboardButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.AbstractInlineKeyboardButton,
      Telegram.InlineKeyboardButton.AbstractInlineKeyboardButton
    >
  >;
  InlineKeyboardButtonUrlButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.UrlButton,
      keyof Original.InlineKeyboardButton.UrlButton
    >
  >;
  InlineKeyboardButtonUrlButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.UrlButton>,
      RequiredKeys<Original.InlineKeyboardButton.UrlButton>
    >
  >;
  InlineKeyboardButtonUrlButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.UrlButton,
      Original.InlineKeyboardButton.UrlButton
    >
  >;
  InlineKeyboardButtonUrlButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.UrlButton,
      Telegram.InlineKeyboardButton.UrlButton
    >
  >;
  InlineKeyboardButtonCallbackButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.CallbackButton,
      keyof Original.InlineKeyboardButton.CallbackButton
    >
  >;
  InlineKeyboardButtonCallbackButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.CallbackButton>,
      RequiredKeys<Original.InlineKeyboardButton.CallbackButton>
    >
  >;
  InlineKeyboardButtonCallbackButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.CallbackButton,
      Original.InlineKeyboardButton.CallbackButton
    >
  >;
  InlineKeyboardButtonCallbackButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.CallbackButton,
      Telegram.InlineKeyboardButton.CallbackButton
    >
  >;
  InlineKeyboardButtonWebAppButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.WebAppButton,
      keyof Original.InlineKeyboardButton.WebAppButton
    >
  >;
  InlineKeyboardButtonWebAppButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.WebAppButton>,
      RequiredKeys<Original.InlineKeyboardButton.WebAppButton>
    >
  >;
  InlineKeyboardButtonWebAppButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.WebAppButton,
      Original.InlineKeyboardButton.WebAppButton
    >
  >;
  InlineKeyboardButtonWebAppButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.WebAppButton,
      Telegram.InlineKeyboardButton.WebAppButton
    >
  >;
  InlineKeyboardButtonLoginButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.LoginButton,
      keyof Original.InlineKeyboardButton.LoginButton
    >
  >;
  InlineKeyboardButtonLoginButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.LoginButton>,
      RequiredKeys<Original.InlineKeyboardButton.LoginButton>
    >
  >;
  InlineKeyboardButtonLoginButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.LoginButton,
      Original.InlineKeyboardButton.LoginButton
    >
  >;
  InlineKeyboardButtonLoginButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.LoginButton,
      Telegram.InlineKeyboardButton.LoginButton
    >
  >;
  InlineKeyboardButtonDisabledButtonButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.DisabledButtonButton,
      keyof Original.InlineKeyboardButton.DisabledButtonButton
    >
  >;
  InlineKeyboardButtonDisabledButtonButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.DisabledButtonButton>,
      RequiredKeys<Original.InlineKeyboardButton.DisabledButtonButton>
    >
  >;
  InlineKeyboardButtonDisabledButtonButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.DisabledButtonButton,
      Original.InlineKeyboardButton.DisabledButtonButton
    >
  >;
  InlineKeyboardButtonDisabledButtonButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.DisabledButtonButton,
      Telegram.InlineKeyboardButton.DisabledButtonButton
    >
  >;
  InlineKeyboardButtonSwitchInlineButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.SwitchInlineButton,
      keyof Original.InlineKeyboardButton.SwitchInlineButton
    >
  >;
  InlineKeyboardButtonSwitchInlineButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.SwitchInlineButton>,
      RequiredKeys<Original.InlineKeyboardButton.SwitchInlineButton>
    >
  >;
  InlineKeyboardButtonSwitchInlineButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.SwitchInlineButton,
      Original.InlineKeyboardButton.SwitchInlineButton
    >
  >;
  InlineKeyboardButtonSwitchInlineButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.SwitchInlineButton,
      Telegram.InlineKeyboardButton.SwitchInlineButton
    >
  >;
  InlineKeyboardButtonSwitchInlineCurrentChatButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.SwitchInlineCurrentChatButton,
      keyof Original.InlineKeyboardButton.SwitchInlineCurrentChatButton
    >
  >;
  InlineKeyboardButtonSwitchInlineCurrentChatButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.SwitchInlineCurrentChatButton>,
      RequiredKeys<Original.InlineKeyboardButton.SwitchInlineCurrentChatButton>
    >
  >;
  InlineKeyboardButtonSwitchInlineCurrentChatButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.SwitchInlineCurrentChatButton,
      Original.InlineKeyboardButton.SwitchInlineCurrentChatButton
    >
  >;
  InlineKeyboardButtonSwitchInlineCurrentChatButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.SwitchInlineCurrentChatButton,
      Telegram.InlineKeyboardButton.SwitchInlineCurrentChatButton
    >
  >;
  InlineKeyboardButtonSwitchInlineChosenChatButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.SwitchInlineChosenChatButton,
      keyof Original.InlineKeyboardButton.SwitchInlineChosenChatButton
    >
  >;
  InlineKeyboardButtonSwitchInlineChosenChatButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.SwitchInlineChosenChatButton>,
      RequiredKeys<Original.InlineKeyboardButton.SwitchInlineChosenChatButton>
    >
  >;
  InlineKeyboardButtonSwitchInlineChosenChatButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.SwitchInlineChosenChatButton,
      Original.InlineKeyboardButton.SwitchInlineChosenChatButton
    >
  >;
  InlineKeyboardButtonSwitchInlineChosenChatButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.SwitchInlineChosenChatButton,
      Telegram.InlineKeyboardButton.SwitchInlineChosenChatButton
    >
  >;
  InlineKeyboardButtonCopyTextButtonButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.CopyTextButtonButton,
      keyof Original.InlineKeyboardButton.CopyTextButtonButton
    >
  >;
  InlineKeyboardButtonCopyTextButtonButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.CopyTextButtonButton>,
      RequiredKeys<Original.InlineKeyboardButton.CopyTextButtonButton>
    >
  >;
  InlineKeyboardButtonCopyTextButtonButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.CopyTextButtonButton,
      Original.InlineKeyboardButton.CopyTextButtonButton
    >
  >;
  InlineKeyboardButtonCopyTextButtonButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.CopyTextButtonButton,
      Telegram.InlineKeyboardButton.CopyTextButtonButton
    >
  >;
  InlineKeyboardButtonGameButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.GameButton,
      keyof Original.InlineKeyboardButton.GameButton
    >
  >;
  InlineKeyboardButtonGameButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.GameButton>,
      RequiredKeys<Original.InlineKeyboardButton.GameButton>
    >
  >;
  InlineKeyboardButtonGameButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.GameButton,
      Original.InlineKeyboardButton.GameButton
    >
  >;
  InlineKeyboardButtonGameButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.GameButton,
      Telegram.InlineKeyboardButton.GameButton
    >
  >;
  InlineKeyboardButtonPayButton: Assert<
    Equal<
      keyof Telegram.InlineKeyboardButton.PayButton,
      keyof Original.InlineKeyboardButton.PayButton
    >
  >;
  InlineKeyboardButtonPayButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.InlineKeyboardButton.PayButton>,
      RequiredKeys<Original.InlineKeyboardButton.PayButton>
    >
  >;
  InlineKeyboardButtonPayButtonSdk: Assert<
    Accepts<
      Telegram.InlineKeyboardButton.PayButton,
      Original.InlineKeyboardButton.PayButton
    >
  >;
  InlineKeyboardButtonPayButtonOwned: Assert<
    Accepts<
      Original.InlineKeyboardButton.PayButton,
      Telegram.InlineKeyboardButton.PayButton
    >
  >;
  KeyboardButtonCommonButton: Assert<
    Equal<
      keyof Telegram.KeyboardButton.CommonButton,
      keyof Original.KeyboardButton.CommonButton
    >
  >;
  KeyboardButtonCommonButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.KeyboardButton.CommonButton>,
      RequiredKeys<Original.KeyboardButton.CommonButton>
    >
  >;
  KeyboardButtonCommonButtonSdk: Assert<
    Accepts<
      Telegram.KeyboardButton.CommonButton,
      Original.KeyboardButton.CommonButton
    >
  >;
  KeyboardButtonCommonButtonOwned: Assert<
    Accepts<
      Original.KeyboardButton.CommonButton,
      Telegram.KeyboardButton.CommonButton
    >
  >;
  KeyboardButtonRequestUsersButton: Assert<
    Equal<
      keyof Telegram.KeyboardButton.RequestUsersButton,
      keyof Original.KeyboardButton.RequestUsersButton
    >
  >;
  KeyboardButtonRequestUsersButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.KeyboardButton.RequestUsersButton>,
      RequiredKeys<Original.KeyboardButton.RequestUsersButton>
    >
  >;
  KeyboardButtonRequestUsersButtonSdk: Assert<
    Accepts<
      Telegram.KeyboardButton.RequestUsersButton,
      Original.KeyboardButton.RequestUsersButton
    >
  >;
  KeyboardButtonRequestUsersButtonOwned: Assert<
    Accepts<
      Original.KeyboardButton.RequestUsersButton,
      Telegram.KeyboardButton.RequestUsersButton
    >
  >;
  KeyboardButtonRequestChatButton: Assert<
    Equal<
      keyof Telegram.KeyboardButton.RequestChatButton,
      keyof Original.KeyboardButton.RequestChatButton
    >
  >;
  KeyboardButtonRequestChatButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.KeyboardButton.RequestChatButton>,
      RequiredKeys<Original.KeyboardButton.RequestChatButton>
    >
  >;
  KeyboardButtonRequestChatButtonSdk: Assert<
    Accepts<
      Telegram.KeyboardButton.RequestChatButton,
      Original.KeyboardButton.RequestChatButton
    >
  >;
  KeyboardButtonRequestChatButtonOwned: Assert<
    Accepts<
      Original.KeyboardButton.RequestChatButton,
      Telegram.KeyboardButton.RequestChatButton
    >
  >;
  KeyboardButtonRequestContactButton: Assert<
    Equal<
      keyof Telegram.KeyboardButton.RequestContactButton,
      keyof Original.KeyboardButton.RequestContactButton
    >
  >;
  KeyboardButtonRequestContactButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.KeyboardButton.RequestContactButton>,
      RequiredKeys<Original.KeyboardButton.RequestContactButton>
    >
  >;
  KeyboardButtonRequestContactButtonSdk: Assert<
    Accepts<
      Telegram.KeyboardButton.RequestContactButton,
      Original.KeyboardButton.RequestContactButton
    >
  >;
  KeyboardButtonRequestContactButtonOwned: Assert<
    Accepts<
      Original.KeyboardButton.RequestContactButton,
      Telegram.KeyboardButton.RequestContactButton
    >
  >;
  KeyboardButtonRequestLocationButton: Assert<
    Equal<
      keyof Telegram.KeyboardButton.RequestLocationButton,
      keyof Original.KeyboardButton.RequestLocationButton
    >
  >;
  KeyboardButtonRequestLocationButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.KeyboardButton.RequestLocationButton>,
      RequiredKeys<Original.KeyboardButton.RequestLocationButton>
    >
  >;
  KeyboardButtonRequestLocationButtonSdk: Assert<
    Accepts<
      Telegram.KeyboardButton.RequestLocationButton,
      Original.KeyboardButton.RequestLocationButton
    >
  >;
  KeyboardButtonRequestLocationButtonOwned: Assert<
    Accepts<
      Original.KeyboardButton.RequestLocationButton,
      Telegram.KeyboardButton.RequestLocationButton
    >
  >;
  KeyboardButtonRequestPollButton: Assert<
    Equal<
      keyof Telegram.KeyboardButton.RequestPollButton,
      keyof Original.KeyboardButton.RequestPollButton
    >
  >;
  KeyboardButtonRequestPollButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.KeyboardButton.RequestPollButton>,
      RequiredKeys<Original.KeyboardButton.RequestPollButton>
    >
  >;
  KeyboardButtonRequestPollButtonSdk: Assert<
    Accepts<
      Telegram.KeyboardButton.RequestPollButton,
      Original.KeyboardButton.RequestPollButton
    >
  >;
  KeyboardButtonRequestPollButtonOwned: Assert<
    Accepts<
      Original.KeyboardButton.RequestPollButton,
      Telegram.KeyboardButton.RequestPollButton
    >
  >;
  KeyboardButtonRequestManagedBotButton: Assert<
    Equal<
      keyof Telegram.KeyboardButton.RequestManagedBotButton,
      keyof Original.KeyboardButton.RequestManagedBotButton
    >
  >;
  KeyboardButtonRequestManagedBotButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.KeyboardButton.RequestManagedBotButton>,
      RequiredKeys<Original.KeyboardButton.RequestManagedBotButton>
    >
  >;
  KeyboardButtonRequestManagedBotButtonSdk: Assert<
    Accepts<
      Telegram.KeyboardButton.RequestManagedBotButton,
      Original.KeyboardButton.RequestManagedBotButton
    >
  >;
  KeyboardButtonRequestManagedBotButtonOwned: Assert<
    Accepts<
      Original.KeyboardButton.RequestManagedBotButton,
      Telegram.KeyboardButton.RequestManagedBotButton
    >
  >;
  KeyboardButtonWebAppButton: Assert<
    Equal<
      keyof Telegram.KeyboardButton.WebAppButton,
      keyof Original.KeyboardButton.WebAppButton
    >
  >;
  KeyboardButtonWebAppButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.KeyboardButton.WebAppButton>,
      RequiredKeys<Original.KeyboardButton.WebAppButton>
    >
  >;
  KeyboardButtonWebAppButtonSdk: Assert<
    Accepts<
      Telegram.KeyboardButton.WebAppButton,
      Original.KeyboardButton.WebAppButton
    >
  >;
  KeyboardButtonWebAppButtonOwned: Assert<
    Accepts<
      Original.KeyboardButton.WebAppButton,
      Telegram.KeyboardButton.WebAppButton
    >
  >;
  RichMessageButtonAbstractRichMessageButton: Assert<
    Equal<
      keyof Telegram.RichMessageButton.AbstractRichMessageButton,
      keyof Original.RichMessageButton.AbstractRichMessageButton
    >
  >;
  RichMessageButtonAbstractRichMessageButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.RichMessageButton.AbstractRichMessageButton>,
      RequiredKeys<Original.RichMessageButton.AbstractRichMessageButton>
    >
  >;
  RichMessageButtonAbstractRichMessageButtonSdk: Assert<
    Accepts<
      Telegram.RichMessageButton.AbstractRichMessageButton,
      Original.RichMessageButton.AbstractRichMessageButton
    >
  >;
  RichMessageButtonAbstractRichMessageButtonOwned: Assert<
    Accepts<
      Original.RichMessageButton.AbstractRichMessageButton,
      Telegram.RichMessageButton.AbstractRichMessageButton
    >
  >;
  RichMessageButtonUrlButton: Assert<
    Equal<
      keyof Telegram.RichMessageButton.UrlButton,
      keyof Original.RichMessageButton.UrlButton
    >
  >;
  RichMessageButtonUrlButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.RichMessageButton.UrlButton>,
      RequiredKeys<Original.RichMessageButton.UrlButton>
    >
  >;
  RichMessageButtonUrlButtonSdk: Assert<
    Accepts<
      Telegram.RichMessageButton.UrlButton,
      Original.RichMessageButton.UrlButton
    >
  >;
  RichMessageButtonUrlButtonOwned: Assert<
    Accepts<
      Original.RichMessageButton.UrlButton,
      Telegram.RichMessageButton.UrlButton
    >
  >;
  RichMessageButtonCallbackButton: Assert<
    Equal<
      keyof Telegram.RichMessageButton.CallbackButton,
      keyof Original.RichMessageButton.CallbackButton
    >
  >;
  RichMessageButtonCallbackButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.RichMessageButton.CallbackButton>,
      RequiredKeys<Original.RichMessageButton.CallbackButton>
    >
  >;
  RichMessageButtonCallbackButtonSdk: Assert<
    Accepts<
      Telegram.RichMessageButton.CallbackButton,
      Original.RichMessageButton.CallbackButton
    >
  >;
  RichMessageButtonCallbackButtonOwned: Assert<
    Accepts<
      Original.RichMessageButton.CallbackButton,
      Telegram.RichMessageButton.CallbackButton
    >
  >;
  RichMessageButtonWebAppButton: Assert<
    Equal<
      keyof Telegram.RichMessageButton.WebAppButton,
      keyof Original.RichMessageButton.WebAppButton
    >
  >;
  RichMessageButtonWebAppButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.RichMessageButton.WebAppButton>,
      RequiredKeys<Original.RichMessageButton.WebAppButton>
    >
  >;
  RichMessageButtonWebAppButtonSdk: Assert<
    Accepts<
      Telegram.RichMessageButton.WebAppButton,
      Original.RichMessageButton.WebAppButton
    >
  >;
  RichMessageButtonWebAppButtonOwned: Assert<
    Accepts<
      Original.RichMessageButton.WebAppButton,
      Telegram.RichMessageButton.WebAppButton
    >
  >;
  RichMessageButtonLoginUrlButton: Assert<
    Equal<
      keyof Telegram.RichMessageButton.LoginUrlButton,
      keyof Original.RichMessageButton.LoginUrlButton
    >
  >;
  RichMessageButtonLoginUrlButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.RichMessageButton.LoginUrlButton>,
      RequiredKeys<Original.RichMessageButton.LoginUrlButton>
    >
  >;
  RichMessageButtonLoginUrlButtonSdk: Assert<
    Accepts<
      Telegram.RichMessageButton.LoginUrlButton,
      Original.RichMessageButton.LoginUrlButton
    >
  >;
  RichMessageButtonLoginUrlButtonOwned: Assert<
    Accepts<
      Original.RichMessageButton.LoginUrlButton,
      Telegram.RichMessageButton.LoginUrlButton
    >
  >;
  RichMessageButtonSwitchInlineButton: Assert<
    Equal<
      keyof Telegram.RichMessageButton.SwitchInlineButton,
      keyof Original.RichMessageButton.SwitchInlineButton
    >
  >;
  RichMessageButtonSwitchInlineButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.RichMessageButton.SwitchInlineButton>,
      RequiredKeys<Original.RichMessageButton.SwitchInlineButton>
    >
  >;
  RichMessageButtonSwitchInlineButtonSdk: Assert<
    Accepts<
      Telegram.RichMessageButton.SwitchInlineButton,
      Original.RichMessageButton.SwitchInlineButton
    >
  >;
  RichMessageButtonSwitchInlineButtonOwned: Assert<
    Accepts<
      Original.RichMessageButton.SwitchInlineButton,
      Telegram.RichMessageButton.SwitchInlineButton
    >
  >;
  RichMessageButtonSwitchInlineCurrentChatButton: Assert<
    Equal<
      keyof Telegram.RichMessageButton.SwitchInlineCurrentChatButton,
      keyof Original.RichMessageButton.SwitchInlineCurrentChatButton
    >
  >;
  RichMessageButtonSwitchInlineCurrentChatButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.RichMessageButton.SwitchInlineCurrentChatButton>,
      RequiredKeys<Original.RichMessageButton.SwitchInlineCurrentChatButton>
    >
  >;
  RichMessageButtonSwitchInlineCurrentChatButtonSdk: Assert<
    Accepts<
      Telegram.RichMessageButton.SwitchInlineCurrentChatButton,
      Original.RichMessageButton.SwitchInlineCurrentChatButton
    >
  >;
  RichMessageButtonSwitchInlineCurrentChatButtonOwned: Assert<
    Accepts<
      Original.RichMessageButton.SwitchInlineCurrentChatButton,
      Telegram.RichMessageButton.SwitchInlineCurrentChatButton
    >
  >;
  RichMessageButtonSwitchInlineQueryChosenChatButton: Assert<
    Equal<
      keyof Telegram.RichMessageButton.SwitchInlineQueryChosenChatButton,
      keyof Original.RichMessageButton.SwitchInlineQueryChosenChatButton
    >
  >;
  RichMessageButtonSwitchInlineQueryChosenChatButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.RichMessageButton.SwitchInlineQueryChosenChatButton>,
      RequiredKeys<Original.RichMessageButton.SwitchInlineQueryChosenChatButton>
    >
  >;
  RichMessageButtonSwitchInlineQueryChosenChatButtonSdk: Assert<
    Accepts<
      Telegram.RichMessageButton.SwitchInlineQueryChosenChatButton,
      Original.RichMessageButton.SwitchInlineQueryChosenChatButton
    >
  >;
  RichMessageButtonSwitchInlineQueryChosenChatButtonOwned: Assert<
    Accepts<
      Original.RichMessageButton.SwitchInlineQueryChosenChatButton,
      Telegram.RichMessageButton.SwitchInlineQueryChosenChatButton
    >
  >;
  RichMessageButtonCopyTextButtonButton: Assert<
    Equal<
      keyof Telegram.RichMessageButton.CopyTextButtonButton,
      keyof Original.RichMessageButton.CopyTextButtonButton
    >
  >;
  RichMessageButtonCopyTextButtonButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.RichMessageButton.CopyTextButtonButton>,
      RequiredKeys<Original.RichMessageButton.CopyTextButtonButton>
    >
  >;
  RichMessageButtonCopyTextButtonButtonSdk: Assert<
    Accepts<
      Telegram.RichMessageButton.CopyTextButtonButton,
      Original.RichMessageButton.CopyTextButtonButton
    >
  >;
  RichMessageButtonCopyTextButtonButtonOwned: Assert<
    Accepts<
      Original.RichMessageButton.CopyTextButtonButton,
      Telegram.RichMessageButton.CopyTextButtonButton
    >
  >;
  RichMessageButtonDisabledButtonButton: Assert<
    Equal<
      keyof Telegram.RichMessageButton.DisabledButtonButton,
      keyof Original.RichMessageButton.DisabledButtonButton
    >
  >;
  RichMessageButtonDisabledButtonButtonRequired: Assert<
    Equal<
      RequiredKeys<Telegram.RichMessageButton.DisabledButtonButton>,
      RequiredKeys<Original.RichMessageButton.DisabledButtonButton>
    >
  >;
  RichMessageButtonDisabledButtonButtonSdk: Assert<
    Accepts<
      Telegram.RichMessageButton.DisabledButtonButton,
      Original.RichMessageButton.DisabledButtonButton
    >
  >;
  RichMessageButtonDisabledButtonButtonOwned: Assert<
    Accepts<
      Original.RichMessageButton.DisabledButtonButton,
      Telegram.RichMessageButton.DisabledButtonButton
    >
  >;
}
