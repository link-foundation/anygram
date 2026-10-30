import type { BotUpdate } from './index.js';

export interface ContextAliasFields {
  message: 'message';
  editedMessage: 'edited_message';
  channelPost: 'channel_post';
  editedChannelPost: 'edited_channel_post';
  businessConnection: 'business_connection';
  businessMessage: 'business_message';
  editedBusinessMessage: 'edited_business_message';
  deletedBusinessMessages: 'deleted_business_messages';
  guestMessage: 'guest_message';
  stoppedMessageGeneration: 'stopped_message_generation';
  messageReaction: 'message_reaction';
  messageReactionCount: 'message_reaction_count';
  inlineQuery: 'inline_query';
  chosenInlineResult: 'chosen_inline_result';
  callbackQuery: 'callback_query';
  shippingQuery: 'shipping_query';
  preCheckoutQuery: 'pre_checkout_query';
  poll: 'poll';
  pollAnswer: 'poll_answer';
  myChatMember: 'my_chat_member';
  chatMember: 'chat_member';
  managedBot: 'managed_bot';
  chatJoinRequest: 'chat_join_request';
  chatBoost: 'chat_boost';
  removedChatBoost: 'removed_chat_boost';
  purchasedPaidMedia: 'purchased_paid_media';
  subscription: 'subscription';
}

export type ContextUpdateAliases = {
  readonly [K in keyof ContextAliasFields]: BotUpdate[ContextAliasFields[K]];
};
